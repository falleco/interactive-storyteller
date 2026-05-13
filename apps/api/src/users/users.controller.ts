import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { PublicUser } from '@wondertales/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { UpdateParentDto } from './dto/update-parent.dto';
import { UsersService } from './users.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ParentProfilePayload {
  id: string;
  email: string;
  name: string;
  /** OAuth-provided avatar (Google/Apple). */
  image: string | null;
  age: number | null;
  parentRole: string | null;
  /** Uploaded picture URL — takes precedence over `image` on the client. */
  profileImageUrl: string | null;
}

@ApiTags('users')
@Controller('me')
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current parent profile' })
  async getMe(@CurrentUser() user: PublicUser): Promise<ParentProfilePayload> {
    const row = await this.users.findById(user.id);
    if (!row) throw new BadRequestException('User not found');
    return toPayload(row);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update parent profile (name, age, role)',
    description:
      'Only the listed fields can be edited here. Email and image (OAuth avatar) are managed by the auth flow.',
  })
  async updateMe(
    @CurrentUser() user: PublicUser,
    @Body() dto: UpdateParentDto,
  ): Promise<ParentProfilePayload> {
    const updated = await this.users.updateParent({
      userId: user.id,
      data: dto,
    });
    return toPayload(updated);
  }

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload the parent profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async uploadImage(
    @CurrentUser() user: PublicUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ParentProfilePayload> {
    if (!file) {
      throw new BadRequestException('Missing file');
    }
    const updated = await this.users.uploadProfileImage({
      userId: user.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
    return toPayload(updated);
  }
}

function toPayload(row: {
  id: string;
  email: string;
  name: string;
  image: string | null;
  age: number | null;
  parentRole: string | null;
  profileImageUrl: string | null;
}): ParentProfilePayload {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    age: row.age,
    parentRole: row.parentRole,
    profileImageUrl: row.profileImageUrl,
  };
}
