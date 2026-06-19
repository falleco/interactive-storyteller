import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  Book,
  BookChoice,
  BookPage,
  CuratedBook,
  CuratedBookLocalization,
  CuratedBookPage,
  CuratedBookPageLocalization,
} from '@prisma/client';
import type { StoryGameDescriptor } from '@wondertales/shared/games';
import type {
  NarrationAudioTiming,
  NarrationBlock,
} from '@wondertales/shared/stories';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface BookSummary {
  id: string;
  title: string;
  status: string;
  mode: string;
  language: string;
  storyteller: string;
  defaultVoice: string;
  coverImageUrl: string | null;
  pageCount: number;
  /** Number of times the user has marked this book as fully read. */
  completedReadCount: number;
  createdAt: string;
  updatedAt: string;
  isCurated?: boolean;
}

export interface BookChoicePayload {
  id: string;
  choiceIndex: number;
  label: string;
  imageUrl: string | null;
  selected: boolean;
}

export interface BookPagePayload {
  id: string;
  pageNumber: number;
  pageType: 'story' | 'game';
  title: string;
  content: string;
  narrationText: string;
  narrationBlocks: NarrationBlock[];
  imageUrl: string | null;
  audioUrl: string | null;
  game: StoryGameDescriptor | null;
  gameCompletedAt: string | null;
  choices: BookChoicePayload[];
}

export interface BookDetail extends BookSummary {
  characterDescription: string | null;
  titleAudioUrl: string | null;
  pages: BookPagePayload[];
}

interface BookLocaleOptions {
  language?: string;
}

type CuratedBookDetailRow = CuratedBook & {
  localizations: CuratedBookLocalization[];
  pages: Array<
    CuratedBookPage & { localizations: CuratedBookPageLocalization[] }
  >;
};

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listForUser(
    userId: string,
    options: BookLocaleOptions = {},
  ): Promise<BookSummary[]> {
    const [owned, curated] = await Promise.all([
      this.prisma.book.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          mode: true,
          language: true,
          storyteller: true,
          coverImageUrl: true,
          pageCount: true,
          completedReadCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.curatedBook.findMany({
        where: { status: 'published', publishedAt: { not: null } },
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        include: {
          localizations: true,
          pages: { select: { game: true } },
          _count: { select: { pages: true } },
        },
      }),
    ]);

    const ownedSummaries = owned.map((row) => ({
      ...row,
      defaultVoice: row.storyteller,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
    const curatedSummaries = curated.map((row) => {
      const localization = pickLocalization(
        row.localizations,
        options.language,
        row.baseLanguage,
      );
      return {
        id: row.id,
        title: localization?.title ?? row.slug,
        status: 'ready',
        mode: row.pages.some((page) => page.game) ? 'magic' : 'classic',
        language:
          localization?.language ?? options.language ?? row.baseLanguage,
        storyteller: row.storyteller,
        defaultVoice: row.defaultVoice ?? row.storyteller,
        coverImageUrl: row.coverImageUrl,
        pageCount: row._count.pages,
        completedReadCount: 0,
        createdAt: (row.publishedAt ?? row.createdAt).toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        isCurated: true,
      };
    });

    return [...curatedSummaries, ...ownedSummaries];
  }

  async getOwnedDetailOrThrow(input: {
    id: string;
    userId: string;
  }): Promise<BookDetail> {
    const book = await this.prisma.book.findUnique({
      where: { id: input.id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            choices: { orderBy: { choiceIndex: 'asc' } },
          },
        },
      },
    });
    if (!book) {
      throw new NotFoundException('Book not found');
    }
    if (book.userId !== input.userId) {
      throw new ForbiddenException('You do not own this book');
    }
    return toBookDetail(book);
  }

  async getVisibleDetailOrThrow(input: {
    id: string;
    userId: string;
    language?: string;
  }): Promise<BookDetail> {
    const book = await this.prisma.book.findUnique({
      where: { id: input.id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            choices: { orderBy: { choiceIndex: 'asc' } },
          },
        },
      },
    });
    if (book) {
      if (book.userId !== input.userId) {
        throw new ForbiddenException('You do not own this book');
      }
      return toBookDetail(book);
    }

    const curated = await this.prisma.curatedBook.findFirst({
      where: {
        id: input.id,
        status: 'published',
        publishedAt: { not: null },
      },
      include: {
        localizations: true,
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: { localizations: true },
        },
      },
    });
    if (!curated) {
      throw new NotFoundException('Book not found');
    }
    return toCuratedBookDetail(curated, input.language);
  }

  /**
   * Delete a book the user owns. Cleans up associated S3/R2 objects first
   * (best-effort — failures are logged but do not block the DB delete),
   * then drops the Book row. Pages + choices cascade via Prisma relations.
   */
  async deleteOwned(input: { id: string; userId: string }): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        userId: true,
        coverImageObjectKey: true,
        titleAudioObjectKey: true,
        pages: {
          select: {
            imageObjectKey: true,
            audioObjectKey: true,
            choices: { select: { imageObjectKey: true } },
          },
        },
      },
    });
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId !== input.userId) {
      throw new ForbiddenException('You do not own this book');
    }

    const keys: string[] = [];
    if (book.coverImageObjectKey) keys.push(book.coverImageObjectKey);
    if (book.titleAudioObjectKey) keys.push(book.titleAudioObjectKey);
    for (const page of book.pages) {
      if (page.imageObjectKey) keys.push(page.imageObjectKey);
      if (page.audioObjectKey) keys.push(page.audioObjectKey);
      for (const choice of page.choices) {
        if (choice.imageObjectKey) keys.push(choice.imageObjectKey);
      }
    }

    if (keys.length > 0) {
      try {
        await this.storage.deleteMany(keys);
      } catch (e) {
        // Bucket cleanup is best-effort; orphan objects can be reaped later.
        this.logger.warn(
          `R2 cleanup failed for book ${book.id} (${keys.length} keys): ${(e as Error).message}`,
        );
      }
    }

    await this.prisma.book.delete({ where: { id: input.id } });
  }

  async incrementCompletedRead(input: {
    id: string;
    userId: string;
  }): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: input.id },
      select: { id: true, userId: true, completedAt: true },
    });
    if (!book) {
      const curated = await this.findPublishedCuratedBook(input.id);
      if (curated) return;
      throw new NotFoundException('Book not found');
    }
    if (book.userId !== input.userId) {
      throw new ForbiddenException('You do not own this book');
    }
    await this.prisma.book.update({
      where: { id: input.id },
      data: {
        completedReadCount: { increment: 1 },
        lastCompletedReadAt: new Date(),
        ...(book.completedAt ? {} : { completedAt: new Date() }),
      },
    });
  }

  async hasPublishedCuratedPageGame(input: {
    bookId: string;
    pageId: string;
    gameId?: string;
  }): Promise<boolean> {
    const page = await this.prisma.curatedBookPage.findFirst({
      where: {
        id: input.pageId,
        bookId: input.bookId,
        book: { status: 'published', publishedAt: { not: null } },
      },
      select: { game: true },
    });
    if (!page) return false;
    const game = parseStoryGameDescriptor(page.game);
    if (!game) return false;
    return input.gameId ? game.id === input.gameId : true;
  }

  private findPublishedCuratedBook(id: string): Promise<{ id: string } | null> {
    return this.prisma.curatedBook.findFirst({
      where: {
        id,
        status: 'published',
        publishedAt: { not: null },
      },
      select: { id: true },
    });
  }
}

function toBookDetail(
  book: Book & { pages: Array<BookPage & { choices: BookChoice[] }> },
): BookDetail {
  return {
    id: book.id,
    title: book.title,
    status: book.status,
    mode: book.mode,
    language: book.language,
    storyteller: book.storyteller,
    defaultVoice: book.storyteller,
    coverImageUrl: book.coverImageUrl,
    pageCount: book.pageCount,
    completedReadCount: book.completedReadCount,
    characterDescription: book.characterDescription,
    titleAudioUrl: book.titleAudioUrl,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
    pages: book.pages.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      pageType: 'story',
      title: p.title,
      content: p.content,
      narrationText: p.narrationText,
      narrationBlocks: buildNarrationBlocks({
        value: null,
        fallbackText: p.narrationText || p.content,
        defaultVoice: book.storyteller,
        fallbackAudioUrl: p.audioUrl,
      }),
      imageUrl: p.imageUrl,
      audioUrl: p.audioUrl,
      game: parseStoryGameDescriptor(p.game),
      gameCompletedAt: p.gameCompletedAt?.toISOString() ?? null,
      choices: p.choices.map((c) => ({
        id: c.id,
        choiceIndex: c.choiceIndex,
        label: c.label,
        imageUrl: c.imageUrl,
        selected: c.selected,
      })),
    })),
  };
}

function toCuratedBookDetail(
  book: CuratedBookDetailRow,
  language?: string,
): BookDetail {
  const localization = pickLocalization(
    book.localizations,
    language,
    book.baseLanguage,
  );
  const resolvedLanguage =
    localization?.language ?? language ?? book.baseLanguage;
  return {
    id: book.id,
    title: localization?.title ?? book.slug,
    status: 'ready',
    mode: book.pages.some((page) => page.game) ? 'magic' : 'classic',
    language: resolvedLanguage,
    storyteller: book.storyteller,
    defaultVoice: book.defaultVoice ?? book.storyteller,
    coverImageUrl: book.coverImageUrl,
    pageCount: book.pages.length,
    completedReadCount: 0,
    characterDescription: localization?.summary ?? null,
    titleAudioUrl: null,
    createdAt: (book.publishedAt ?? book.createdAt).toISOString(),
    updatedAt: book.updatedAt.toISOString(),
    isCurated: true,
    pages: book.pages.map((page) => {
      const pageLocalization = pickLocalization(
        page.localizations,
        resolvedLanguage,
        book.baseLanguage,
      );
      return {
        id: page.id,
        pageNumber: page.pageNumber,
        pageType: page.pageType === 'game' ? 'game' : 'story',
        title: `Page ${page.pageNumber}`,
        content: pageLocalization?.content ?? '',
        narrationText:
          pageLocalization?.narrationText ?? pageLocalization?.content ?? '',
        narrationBlocks: buildNarrationBlocks({
          value: pageLocalization?.narrationBlocks,
          fallbackText:
            pageLocalization?.narrationText ?? pageLocalization?.content ?? '',
          defaultVoice: book.defaultVoice ?? book.storyteller,
          fallbackAudioUrl: pageLocalization?.audioUrl ?? null,
        }),
        imageUrl: page.imageUrl,
        audioUrl: pageLocalization?.audioUrl ?? null,
        game: parseStoryGameDescriptor(page.game),
        gameCompletedAt: null,
        choices: [],
      };
    }),
  };
}

function buildNarrationBlocks(input: {
  value: unknown;
  fallbackText: string;
  defaultVoice: string;
  fallbackAudioUrl?: string | null;
}): NarrationBlock[] {
  const parsed = parseNarrationBlocks(input.value);
  const blocks =
    parsed.length > 0
      ? parsed
      : input.fallbackText.trim()
        ? [
            {
              id: 'block-1',
              kind: 'narration',
              text: input.fallbackText.trim(),
              voice: null,
              speaker: null,
              audioUrl: input.fallbackAudioUrl ?? null,
              audioObjectKey: null,
              audioTiming: null,
            } satisfies NarrationBlock,
          ]
        : [];
  return blocks.map((block) => ({
    ...block,
    voice:
      block.voice && block.voice !== input.defaultVoice ? block.voice : null,
  }));
}

function parseNarrationBlocks(value: unknown): NarrationBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): NarrationBlock | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const text = typeof raw.text === 'string' ? raw.text.trim() : '';
      if (!text) return null;
      return {
        id:
          typeof raw.id === 'string' && raw.id ? raw.id : `block-${index + 1}`,
        kind:
          raw.kind === 'dialogue' || raw.kind === 'aside'
            ? raw.kind
            : 'narration',
        text,
        voice: typeof raw.voice === 'string' && raw.voice ? raw.voice : null,
        speaker:
          typeof raw.speaker === 'string' && raw.speaker ? raw.speaker : null,
        audioUrl:
          typeof raw.audioUrl === 'string' && raw.audioUrl
            ? raw.audioUrl
            : null,
        audioObjectKey:
          typeof raw.audioObjectKey === 'string' && raw.audioObjectKey
            ? raw.audioObjectKey
            : null,
        audioTiming: parseNarrationAudioTiming(raw.audioTiming),
      } satisfies NarrationBlock;
    })
    .filter((item): item is NarrationBlock => item !== null);
}

function parseNarrationAudioTiming(
  value: unknown,
): NarrationAudioTiming | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const words = parseNarrationWordTimings(raw.words);
  if (raw.provider !== 'inworld' || words.length === 0) return null;
  return {
    provider: 'inworld',
    model: typeof raw.model === 'string' ? raw.model : '',
    voice: typeof raw.voice === 'string' ? raw.voice : '',
    language: typeof raw.language === 'string' ? raw.language : '',
    words,
    phrases: parseNarrationPhraseTimings(raw.phrases),
    duration: typeof raw.duration === 'number' ? raw.duration : null,
  };
}

function parseNarrationWordTimings(
  value: unknown,
): NarrationAudioTiming['words'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): NarrationAudioTiming['words'][number] | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (
        typeof raw.word !== 'string' ||
        typeof raw.startTime !== 'number' ||
        typeof raw.endTime !== 'number'
      ) {
        return null;
      }
      return {
        word: raw.word,
        startTime: raw.startTime,
        endTime: raw.endTime,
      };
    })
    .filter(
      (item): item is NarrationAudioTiming['words'][number] => item !== null,
    );
}

function parseNarrationPhraseTimings(
  value: unknown,
): NarrationAudioTiming['phrases'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): NarrationAudioTiming['phrases'][number] | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (
        typeof raw.text !== 'string' ||
        typeof raw.startTime !== 'number' ||
        typeof raw.endTime !== 'number' ||
        typeof raw.wordStartIndex !== 'number' ||
        typeof raw.wordEndIndex !== 'number'
      ) {
        return null;
      }
      return {
        text: raw.text,
        startTime: raw.startTime,
        endTime: raw.endTime,
        wordStartIndex: raw.wordStartIndex,
        wordEndIndex: raw.wordEndIndex,
      };
    })
    .filter(
      (item): item is NarrationAudioTiming['phrases'][number] => item !== null,
    );
}

function pickLocalization<T extends { language: string }>(
  localizations: T[],
  requestedLanguage: string | undefined,
  baseLanguage: string,
): T | undefined {
  return (
    (requestedLanguage
      ? localizations.find((item) => item.language === requestedLanguage)
      : undefined) ??
    localizations.find((item) => item.language === baseLanguage) ??
    localizations.find((item) => item.language === 'en') ??
    localizations[0]
  );
}

function parseStoryGameDescriptor(value: unknown): StoryGameDescriptor | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const ageRange = v.ageRange;
  if (
    typeof v.id !== 'string' ||
    typeof v.type !== 'string' ||
    typeof v.title !== 'string' ||
    typeof v.prompt !== 'string' ||
    !ageRange ||
    typeof ageRange !== 'object'
  ) {
    return null;
  }
  const age = ageRange as Record<string, unknown>;
  if (typeof age.min !== 'number' || typeof age.max !== 'number') {
    return null;
  }
  return {
    id: v.id,
    type: v.type,
    title: v.title,
    ageRange: { min: age.min, max: age.max },
    prompt: v.prompt,
    config:
      v.config && typeof v.config === 'object'
        ? (v.config as Record<string, unknown>)
        : {},
    narration:
      v.narration && typeof v.narration === 'object'
        ? (v.narration as StoryGameDescriptor['narration'])
        : undefined,
  };
}
