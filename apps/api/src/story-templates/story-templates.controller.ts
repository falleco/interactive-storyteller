import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PublicUser } from '@wondertales/shared';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CreateStoryTemplateDto } from './dto/create-story-template.dto';
import { UpdateStoryTemplateDto } from './dto/update-story-template.dto';
import { StoryTemplatesService } from './story-templates.service';

@ApiTags('story-templates')
@Controller('story-templates')
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class StoryTemplatesController {
  constructor(private readonly templates: StoryTemplatesService) {}

  @Get()
  @ApiOperation({
    summary: 'List story templates visible to me',
    description:
      'Returns every enabled public template plus the templates the current user owns.',
  })
  list(@CurrentUser() user: PublicUser) {
    return this.templates.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a private story template' })
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateStoryTemplateDto) {
    return this.templates.createForUser({ userId: user.id, data: dto });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit a private story template (public templates are immutable)',
  })
  update(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Body() dto: UpdateStoryTemplateDto,
  ) {
    return this.templates.updateForUser({
      id,
      userId: user.id,
      data: dto,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a story template the current user owns' })
  async remove(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    await this.templates.remove({ id, userId: user.id });
  }
}
