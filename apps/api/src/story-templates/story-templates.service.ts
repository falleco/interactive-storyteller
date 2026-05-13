import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StoryTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStoryTemplateDto } from './dto/create-story-template.dto';
import type { UpdateStoryTemplateDto } from './dto/update-story-template.dto';

export interface StoryTemplatePayload {
  id: string;
  title: string;
  description: string | null;
  theme: string;
  language: string | null;
  coverImageUrl: string | null;
  isOwned: boolean;
}

@Injectable()
export class StoryTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List templates available to a user: every enabled public template
   * (`userId = null`) plus the templates the user owns. Public first, then
   * the user's own, both sorted by sortOrder then createdAt.
   */
  async listForUser(userId: string): Promise<StoryTemplatePayload[]> {
    const rows = await this.prisma.storyTemplate.findMany({
      where: {
        enabled: true,
        OR: [{ userId: null }, { userId }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => toPayload(row, userId));
  }

  async createForUser(input: {
    userId: string;
    data: CreateStoryTemplateDto;
  }): Promise<StoryTemplatePayload> {
    const created = await this.prisma.storyTemplate.create({
      data: {
        userId: input.userId,
        title: input.data.title,
        description: input.data.description ?? null,
        theme: input.data.theme,
        language: input.data.language ?? null,
      },
    });
    return toPayload(created, input.userId);
  }

  /**
   * Edit an owned template. Public templates are immutable (admins can edit
   * those via the seed script).
   */
  async updateForUser(input: {
    id: string;
    userId: string;
    data: UpdateStoryTemplateDto;
  }): Promise<StoryTemplatePayload> {
    const template = await this.prisma.storyTemplate.findUnique({
      where: { id: input.id },
      select: { id: true, userId: true },
    });
    if (!template) {
      throw new NotFoundException('Story template not found');
    }
    if (template.userId === null) {
      throw new ForbiddenException('Cannot edit a public template');
    }
    if (template.userId !== input.userId) {
      throw new ForbiddenException('You do not own this story template');
    }

    const updated = await this.prisma.storyTemplate.update({
      where: { id: input.id },
      data: {
        ...(input.data.title !== undefined ? { title: input.data.title } : {}),
        ...(input.data.description !== undefined
          ? { description: input.data.description }
          : {}),
        ...(input.data.theme !== undefined ? { theme: input.data.theme } : {}),
        ...(input.data.language !== undefined
          ? { language: input.data.language }
          : {}),
        ...(input.data.enabled !== undefined
          ? { enabled: input.data.enabled }
          : {}),
      },
    });
    return toPayload(updated, input.userId);
  }

  /**
   * Resolve a template the user is allowed to use (public or own). Throws
   * 404 if missing, 403 if it belongs to a different user. Used by book
   * generation to load the template's prompt text on demand.
   */
  async getVisibleOrThrow(input: {
    id: string;
    userId: string;
  }): Promise<StoryTemplate> {
    const template = await this.prisma.storyTemplate.findUnique({
      where: { id: input.id },
    });
    if (!template) {
      throw new NotFoundException('Story template not found');
    }
    if (template.userId !== null && template.userId !== input.userId) {
      throw new ForbiddenException('You do not have access to this template');
    }
    if (!template.enabled) {
      throw new NotFoundException('Story template is disabled');
    }
    return template;
  }

  async remove(input: { id: string; userId: string }): Promise<void> {
    const template = await this.prisma.storyTemplate.findUnique({
      where: { id: input.id },
      select: { id: true, userId: true },
    });
    if (!template) {
      throw new NotFoundException('Story template not found');
    }
    if (template.userId === null) {
      throw new ForbiddenException('Cannot delete a public template');
    }
    if (template.userId !== input.userId) {
      throw new ForbiddenException('You do not own this story template');
    }
    await this.prisma.storyTemplate.delete({ where: { id: input.id } });
  }
}

function toPayload(
  row: StoryTemplate,
  currentUserId: string,
): StoryTemplatePayload {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    theme: row.theme,
    language: row.language,
    coverImageUrl: row.coverImageUrl,
    isOwned: row.userId === currentUserId,
  };
}
