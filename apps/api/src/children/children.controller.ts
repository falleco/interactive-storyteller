import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

@ApiTags('children')
@Controller('children')
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  @Get()
  @ApiOperation({ summary: 'List my child profiles' })
  list(@CurrentUser() user: PublicUser) {
    return this.children.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a child profile' })
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateChildDto) {
    return this.children.create({ userId: user.id, data: dto });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single child profile I own' })
  get(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.children.getOwnedOrThrow({ id, userId: user.id });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a child profile' })
  update(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.children.update({ id, userId: user.id, data: dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a child profile' })
  async remove(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    await this.children.remove({ id, userId: user.id });
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload the child profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  uploadImage(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Missing file');
    }
    return this.children.uploadImage({
      id,
      userId: user.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }
}
