import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { UpdateParentDto } from './dto/update-parent.dto';

const ALLOWED_IMAGE_MIME_TYPES: ReadonlyArray<string> = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async updateParent(input: {
    userId: string;
    data: UpdateParentDto;
  }): Promise<User> {
    const data: Record<string, unknown> = {};
    if (input.data.name !== undefined) data.name = input.data.name;
    if (input.data.age !== undefined) data.age = input.data.age;
    if (input.data.parentRole !== undefined) {
      data.parentRole = input.data.parentRole;
    }
    return this.prisma.user.update({
      where: { id: input.userId },
      data,
    });
  }

  /**
   * Upload the parent's profile picture. Replaces any previous upload and
   * cleans up the old R2 object (best-effort).
   */
  async uploadProfileImage(input: {
    userId: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<User> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(input.mimeType)) {
      throw new ForbiddenException(
        `Unsupported image type. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, profileImageObjectKey: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const extension = EXTENSION_BY_MIME_TYPE[input.mimeType] ?? 'jpg';
    const objectKey = this.storage.buildObjectKey(
      'users',
      input.userId,
      'profile',
      `avatar-${Date.now()}.${extension}`,
    );

    const { url } = await this.storage.upload({
      key: objectKey,
      body: input.buffer,
      contentType: input.mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    // Cleanup the previous picture so R2 doesn't accumulate orphan avatars.
    // Failure shouldn't block the new upload.
    if (user.profileImageObjectKey) {
      try {
        await this.storage.deleteMany([user.profileImageObjectKey]);
      } catch {
        // swallow — old object stays around as bucket litter
      }
    }

    return this.prisma.user.update({
      where: { id: input.userId },
      data: {
        profileImageUrl: url,
        profileImageObjectKey: objectKey,
      },
    });
  }
}
