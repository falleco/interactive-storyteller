import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Book, Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import { GameMasterService } from '../game-master/game-master.service';
import { composeImagePrompt, STORY_PAGE_COUNT } from '../game-master/prompts';
import type { InteractivePageHistory, StoryBible } from '../game-master/types';
import { PrismaService } from '../prisma/prisma.service';
import { StoryTemplatesService } from '../story-templates/story-templates.service';
import { isLanguage, type Language } from '../storytellers/storyteller-catalog';
import { StorytellersService } from '../storytellers/storytellers.service';
import { BookEventsService } from './book-events.service';
import {
  BOOK_MEDIA_QUEUE,
  BookMediaJobName,
  type ChoiceImageJobData,
  type CoverImageJobData,
  type PageAudioJobData,
  type PageImageJobData,
  type TitleAudioJobData,
} from './book-media.queue';

export interface CreateClassicBookInput {
  userId: string;
  language: string;
  storyteller: string;
  /**
   * Free-form theme text. Used when {@link templateId} is not set. Ignored
   * when both are present — the template wins.
   */
  theme?: string;
  /**
   * If set, the server loads the corresponding {@link StoryTemplate} (public
   * or owned by the user) and uses its `theme` field as the prompt input.
   * The template's id is also recorded on the resulting Book row.
   */
  templateId?: string;
  childProfileId?: string | null;
}

export type CreateInteractiveBookInput = CreateClassicBookInput;

export interface ContinueInteractiveInput {
  bookId: string;
  userId: string;
  choiceIndex: number;
}

const JOB_DEFAULTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
  removeOnFail: { age: 60 * 60 * 24 * 7 },
} as const;

@Injectable()
export class BookGenerationService {
  private readonly logger = new Logger(BookGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameMaster: GameMasterService,
    private readonly storytellers: StorytellersService,
    private readonly templates: StoryTemplatesService,
    @InjectQueue(BOOK_MEDIA_QUEUE) private readonly mediaQueue: Queue,
    private readonly events: BookEventsService,
  ) {}

  /**
   * Resolve the prompt text the GameMaster should use. If a `templateId` was
   * provided, the template wins and its `theme` is loaded from the database
   * (this is intentional — the client passes the id, the server holds the
   * canonical prompt). Otherwise the free-form `theme` text is used as-is.
   * Returns `{ theme, templateId, templateTitle }` so the Book row can
   * record both the link and the snapshot of what was used.
   */
  private async resolveTheme(input: {
    userId: string;
    theme?: string;
    templateId?: string;
  }): Promise<{
    theme: string | undefined;
    templateId: string | null;
    templateTitle: string | null;
  }> {
    if (input.templateId) {
      const tpl = await this.templates.getVisibleOrThrow({
        id: input.templateId,
        userId: input.userId,
      });
      return {
        theme: tpl.theme,
        templateId: tpl.id,
        templateTitle: tpl.title,
      };
    }
    return {
      theme: input.theme,
      templateId: null,
      templateTitle: null,
    };
  }

  /**
   * Create a classic-mode book end-to-end:
   *  1. Validate inputs (storyteller exists for that language)
   *  2. Generate the full story text via GameMaster (single LLM call)
   *  3. Persist Book + BookPage rows
   *  4. Enqueue media jobs (cover image, title audio, each page image+audio)
   *
   * Returns the book row with status="generating". Media jobs run async and
   * flip status to "ready" once cover + first page media are done.
   */
  async createClassic(input: CreateClassicBookInput): Promise<Book> {
    const { language, storyteller, child } =
      await this.validateGenerationInputs(input);
    const childPayload = child
      ? { name: child.name, age: child.age, gender: child.gender }
      : undefined;

    const resolved = await this.resolveTheme({
      userId: input.userId,
      theme: input.theme,
      templateId: input.templateId,
    });

    this.logger.log(
      resolved.templateId
        ? `Generating story bible (user=${input.userId}, language=${language}, template="${resolved.templateTitle}")`
        : `Generating story bible (user=${input.userId}, language=${language})`,
    );
    const { bible, usage: bibleUsage } =
      await this.gameMaster.generateStoryBible({
        language,
        theme: resolved.theme,
        child: childPayload,
      });

    this.logger.log(
      `Generating classic pages for "${bible.title}" (storyteller=${storyteller.identifier})`,
    );
    const story = await this.gameMaster.generateClassic({
      language,
      theme: resolved.theme,
      child: childPayload,
      bible,
    });

    const promptTokens =
      (bibleUsage?.promptTokens ?? 0) + (story.usage?.promptTokens ?? 0);
    const completionTokens =
      (bibleUsage?.completionTokens ?? 0) +
      (story.usage?.completionTokens ?? 0);
    const totalTokens =
      (bibleUsage?.totalTokens ?? 0) + (story.usage?.totalTokens ?? 0);

    const book = await this.prisma.book.create({
      data: {
        userId: input.userId,
        childProfileId: input.childProfileId ?? null,
        status: 'generating',
        mode: 'classic',
        language,
        storyteller: storyteller.identifier,
        // Snapshot the resolved theme on the Book row so future edits to the
        // template don't retroactively change this book's prompt.
        theme: resolved.theme ?? null,
        templateId: resolved.templateId,
        templateLabel: resolved.templateTitle,
        title: bible.title,
        storyBible: bible as unknown as Prisma.InputJsonValue,
        // Legacy text columns kept populated so old code paths and existing
        // queries still work; the bible JSON is the source of truth.
        characterDescription: bible.mainCharacters,
        coverImagePrompt: bible.coverImagePrompt,
        // Snapshot the *final* prompts the media processor will send
        // up-front — at row-create time — so they're inspectable even
        // before the image job runs, and if a generation fails the
        // exact text that would have been sent is still on disk.
        finalCoverImagePrompt: composeImagePrompt(
          bible,
          bible.coverImagePrompt,
        ),
        promptTokens,
        completionTokens,
        totalTokens,
        pageCount: story.pages.length,
        pages: {
          create: story.pages.map((page, index) => ({
            pageNumber: index + 1,
            title: page.title,
            content: page.content,
            narrationText: page.content,
            imagePrompt: page.imagePrompt,
            finalImagePrompt: page.imagePrompt
              ? composeImagePrompt(bible, page.imagePrompt)
              : null,
          })),
        },
      },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });

    await this.enqueueInitialMediaJobs(
      book.id,
      book.pages.map((p) => p.id),
    );

    this.logger.log(
      `Book ${book.id} created with ${book.pages.length} pages, media jobs enqueued`,
    );
    return book;
  }

  /**
   * Create an interactive-mode book — generates ONLY the first page (with two
   * choices and choice image prompts), persists Book + Page 1 + BookChoice
   * rows, and enqueues media jobs (cover, title audio, page 1 image/audio,
   * choice images). Subsequent pages are appended via `continueInteractive`.
   */
  async createInteractive(input: CreateInteractiveBookInput): Promise<Book> {
    const { language, storyteller, child } =
      await this.validateGenerationInputs(input);
    const childPayload = child
      ? { name: child.name, age: child.age, gender: child.gender }
      : undefined;

    const resolved = await this.resolveTheme({
      userId: input.userId,
      theme: input.theme,
      templateId: input.templateId,
    });

    this.logger.log(
      resolved.templateId
        ? `Generating story bible (interactive, user=${input.userId}, language=${language}, template="${resolved.templateTitle}")`
        : `Generating story bible (interactive, user=${input.userId}, language=${language})`,
    );
    const { bible, usage: bibleUsage } =
      await this.gameMaster.generateStoryBible({
        language,
        theme: resolved.theme,
        child: childPayload,
      });

    this.logger.log(
      `Generating interactive page 1 for "${bible.title}" (storyteller=${storyteller.identifier})`,
    );
    const page = await this.gameMaster.generateInteractivePage({
      language,
      theme: resolved.theme,
      child: childPayload,
      bible,
    });

    const promptTokens =
      (bibleUsage?.promptTokens ?? 0) + (page.usage?.promptTokens ?? 0);
    const completionTokens =
      (bibleUsage?.completionTokens ?? 0) + (page.usage?.completionTokens ?? 0);
    const totalTokens =
      (bibleUsage?.totalTokens ?? 0) + (page.usage?.totalTokens ?? 0);

    const book = await this.prisma.book.create({
      data: {
        userId: input.userId,
        childProfileId: input.childProfileId ?? null,
        status: 'generating',
        mode: 'interactive',
        language,
        storyteller: storyteller.identifier,
        theme: resolved.theme ?? null,
        templateId: resolved.templateId,
        templateLabel: resolved.templateTitle,
        title: bible.title,
        storyBible: bible as unknown as Prisma.InputJsonValue,
        characterDescription: bible.mainCharacters,
        coverImagePrompt: bible.coverImagePrompt,
        finalCoverImagePrompt: composeImagePrompt(
          bible,
          bible.coverImagePrompt,
        ),
        promptTokens,
        completionTokens,
        totalTokens,
        pageCount: 1,
        pages: {
          create: {
            pageNumber: 1,
            title: page.title,
            content: page.content,
            narrationText: page.content,
            imagePrompt: page.imagePrompt,
            finalImagePrompt: page.imagePrompt
              ? composeImagePrompt(bible, page.imagePrompt)
              : null,
            choices: {
              create: page.choices.map((choice, idx) => ({
                choiceIndex: idx,
                label: choice.label,
                imagePrompt: choice.imagePrompt || null,
                finalImagePrompt: choice.imagePrompt
                  ? composeImagePrompt(bible, choice.imagePrompt)
                  : null,
              })),
            },
          },
        },
      },
      include: {
        pages: {
          include: { choices: true },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    const firstPage = book.pages[0];
    if (!firstPage) {
      throw new Error('Interactive book was created without page 1');
    }

    await this.enqueueInitialMediaJobs(book.id, [firstPage.id]);
    await this.enqueueChoiceImageJobs(
      book.id,
      firstPage.choices.map((c) => c.id),
    );

    this.logger.log(
      `Book ${book.id} (interactive) created with page 1 + ${firstPage.choices.length} choices, media jobs enqueued`,
    );
    return book;
  }

  /**
   * Continue an interactive book: marks the chosen BookChoice as selected,
   * generates the next page using the history, persists it, and enqueues its
   * media. Returns the book with all pages reloaded.
   *
   * No-op if the book is already at STORY_PAGE_COUNT pages.
   */
  async continueInteractive(input: ContinueInteractiveInput): Promise<Book> {
    const book = await this.prisma.book.findUnique({
      where: { id: input.bookId },
      include: {
        pages: {
          include: { choices: { orderBy: { choiceIndex: 'asc' } } },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId !== input.userId) {
      throw new ForbiddenException('You do not own this book');
    }
    if (book.mode !== 'interactive') {
      throw new BadRequestException('Book is not interactive');
    }

    if (book.pages.length >= STORY_PAGE_COUNT) {
      throw new BadRequestException('Interactive story already finished');
    }

    const lastPage = book.pages[book.pages.length - 1];
    if (!lastPage) {
      throw new Error('Interactive book has no pages');
    }
    if (lastPage.choices.length === 0) {
      throw new BadRequestException('Last page has no choices');
    }

    const chosen = lastPage.choices.find(
      (c) => c.choiceIndex === input.choiceIndex,
    );
    if (!chosen) {
      throw new BadRequestException(
        `Choice index ${input.choiceIndex} not found on last page`,
      );
    }

    if (lastPage.choices.some((c) => c.selected)) {
      throw new BadRequestException(
        'A choice has already been selected on this page',
      );
    }

    // Mark the picked choice as selected so we have a record of the path taken.
    await this.prisma.bookChoice.update({
      where: { id: chosen.id },
      data: { selected: true },
    });

    const history: InteractivePageHistory[] = book.pages.map((p, idx) => ({
      title: p.title,
      content: p.content,
      selectedChoiceLabel:
        idx === book.pages.length - 1
          ? chosen.label
          : p.choices.find((c) => c.selected)?.label,
    }));

    if (!isLanguage(book.language)) {
      throw new BadRequestException(
        `Unsupported language stored on book: ${book.language}`,
      );
    }
    const language: Language = book.language;

    const bible = extractBible(book.storyBible);
    if (!bible) {
      throw new BadRequestException(
        'Book is missing its story bible; cannot continue.',
      );
    }

    this.logger.log(
      `Generating interactive page ${book.pages.length + 1} for book ${book.id}`,
    );
    const next = await this.gameMaster.generateInteractivePage({
      language,
      theme: book.theme ?? undefined,
      previousPages: history,
      bible,
    });

    const nextPageNumber = book.pages.length + 1;

    const created = await this.prisma.bookPage.create({
      data: {
        bookId: book.id,
        pageNumber: nextPageNumber,
        title: next.title,
        content: next.content,
        narrationText: next.content,
        imagePrompt: next.imagePrompt,
        finalImagePrompt: next.imagePrompt
          ? composeImagePrompt(bible, next.imagePrompt)
          : null,
        choices: {
          create: next.choices.map((choice, idx) => ({
            choiceIndex: idx,
            label: choice.label,
            imagePrompt: choice.imagePrompt || null,
            finalImagePrompt: choice.imagePrompt
              ? composeImagePrompt(bible, choice.imagePrompt)
              : null,
          })),
        },
      },
      include: { choices: true },
    });

    const updatedBook = await this.prisma.book.update({
      where: { id: book.id },
      data: {
        pageCount: nextPageNumber,
        promptTokens: { increment: next.usage?.promptTokens ?? 0 },
        completionTokens: { increment: next.usage?.completionTokens ?? 0 },
        totalTokens: { increment: next.usage?.totalTokens ?? 0 },
      },
    });

    await this.enqueuePageMediaJobs(book.id, created.id);
    if (created.choices.length > 0) {
      await this.enqueueChoiceImageJobs(
        book.id,
        created.choices.map((c) => c.id),
      );
    }

    // New page row is visible now — push so any SSE listeners refetch and
    // surface it without waiting for the next media job to land.
    await this.events.publish(book.id);

    this.logger.log(
      `Book ${book.id}: appended page ${nextPageNumber} with ${created.choices.length} choices`,
    );
    return updatedBook;
  }

  /**
   * Re-enqueue all media jobs for a book. Used by retries / future admin tools.
   */
  async enqueueInitialMediaJobs(
    bookId: string,
    pageIds: string[],
  ): Promise<void> {
    await this.mediaQueue.add(
      BookMediaJobName.CoverImage,
      { bookId } satisfies CoverImageJobData,
      JOB_DEFAULTS,
    );
    await this.mediaQueue.add(
      BookMediaJobName.TitleAudio,
      { bookId } satisfies TitleAudioJobData,
      JOB_DEFAULTS,
    );

    for (const pageId of pageIds) {
      await this.enqueuePageMediaJobs(bookId, pageId);
    }
  }

  private async enqueuePageMediaJobs(
    bookId: string,
    pageId: string,
  ): Promise<void> {
    await this.mediaQueue.add(
      BookMediaJobName.PageImage,
      { bookId, pageId } satisfies PageImageJobData,
      JOB_DEFAULTS,
    );
    await this.mediaQueue.add(
      BookMediaJobName.PageAudio,
      { bookId, pageId } satisfies PageAudioJobData,
      JOB_DEFAULTS,
    );
  }

  private async enqueueChoiceImageJobs(
    bookId: string,
    choiceIds: string[],
  ): Promise<void> {
    for (const choiceId of choiceIds) {
      await this.mediaQueue.add(
        BookMediaJobName.ChoiceImage,
        { bookId, choiceId } satisfies ChoiceImageJobData,
        JOB_DEFAULTS,
      );
    }
  }

  private async validateGenerationInputs(input: CreateClassicBookInput) {
    if (!isLanguage(input.language)) {
      throw new BadRequestException(`Unsupported language "${input.language}"`);
    }
    const language: Language = input.language;

    const storyteller = await this.storytellers.findByLanguageAndIdentifier(
      language,
      input.storyteller,
    );
    if (!storyteller) {
      throw new BadRequestException(
        `Storyteller "${input.storyteller}" not found for language "${language}"`,
      );
    }

    const child = await this.resolveChild({
      childProfileId: input.childProfileId,
      userId: input.userId,
    });

    return { language, storyteller, child };
  }

  private async resolveChild(input: {
    childProfileId?: string | null;
    userId: string;
  }) {
    if (!input.childProfileId) return null;
    const child = await this.prisma.childProfile.findUnique({
      where: { id: input.childProfileId },
    });
    if (!child) {
      throw new NotFoundException('Child profile not found');
    }
    if (child.userId !== input.userId) {
      throw new BadRequestException(
        'Child profile does not belong to the current user',
      );
    }
    return child;
  }
}

/**
 * Pull a {@link StoryBible} out of a Prisma JSON column. Returns null when
 * the column is null (legacy books written before the bible feature) or the
 * structure is unrecognizable — callers decide whether that's fatal.
 */
function extractBible(value: unknown): StoryBible | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.title !== 'string' ||
    typeof v.world !== 'string' ||
    typeof v.mainCharacters !== 'string' ||
    typeof v.style !== 'string' ||
    typeof v.coverImagePrompt !== 'string'
  ) {
    return null;
  }
  return {
    title: v.title,
    world: v.world,
    mainCharacters: v.mainCharacters,
    otherCharacters:
      typeof v.otherCharacters === 'string' ? v.otherCharacters : '',
    style: v.style,
    theme: typeof v.theme === 'string' ? v.theme : '',
    coverImagePrompt: v.coverImagePrompt,
  };
}
