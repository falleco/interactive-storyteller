import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ChildProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { CreateChildDto } from './dto/create-child.dto';
import type { UpdateChildDto } from './dto/update-child.dto';

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
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  listForUser(userId: string): Promise<ChildProfile[]> {
    return this.prisma.childProfile.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async getOwnedOrThrow(input: {
    id: string;
    userId: string;
  }): Promise<ChildProfile> {
    const child = await this.prisma.childProfile.findUnique({
      where: { id: input.id },
    });
    if (!child) {
      throw new NotFoundException('Child profile not found');
    }
    if (child.userId !== input.userId) {
      throw new ForbiddenException('You do not own this child profile');
    }
    return child;
  }

  create(input: {
    userId: string;
    data: CreateChildDto;
  }): Promise<ChildProfile> {
    return this.prisma.childProfile.create({
      data: {
        userId: input.userId,
        name: input.data.name,
        age: input.data.age,
        gender: input.data.gender ?? null,
        imageUrl: input.data.imageUrl ?? null,
      },
    });
  }

  async update(input: {
    id: string;
    userId: string;
    data: UpdateChildDto;
  }): Promise<ChildProfile> {
    await this.getOwnedOrThrow({ id: input.id, userId: input.userId });
    return this.prisma.childProfile.update({
      where: { id: input.id },
      data: {
        ...(input.data.name !== undefined ? { name: input.data.name } : {}),
        ...(input.data.age !== undefined ? { age: input.data.age } : {}),
        ...(input.data.gender !== undefined
          ? { gender: input.data.gender }
          : {}),
        ...(input.data.imageUrl !== undefined
          ? { imageUrl: input.data.imageUrl }
          : {}),
      },
    });
  }

  async remove(input: { id: string; userId: string }): Promise<void> {
    await this.getOwnedOrThrow({ id: input.id, userId: input.userId });
    await this.prisma.childProfile.delete({ where: { id: input.id } });
  }

  async uploadImage(input: {
    id: string;
    userId: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<ChildProfile> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(input.mimeType)) {
      throw new ForbiddenException(
        `Unsupported image type. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      );
    }

    await this.getOwnedOrThrow({ id: input.id, userId: input.userId });

    const extension = EXTENSION_BY_MIME_TYPE[input.mimeType] ?? 'jpg';
    const objectKey = this.storage.buildObjectKey(
      'users',
      input.userId,
      'children',
      input.id,
      `avatar-${Date.now()}.${extension}`,
    );

    const { url } = await this.storage.upload({
      key: objectKey,
      body: input.buffer,
      contentType: input.mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    return this.prisma.childProfile.update({
      where: { id: input.id },
      data: { imageUrl: url },
    });
  }
}
