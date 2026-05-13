import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { composeImagePrompt } from '../game-master/prompts';
import type { StoryBible } from '../game-master/types';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { Language } from '../storytellers/storyteller-catalog';
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

@Injectable()
@Processor(BOOK_MEDIA_QUEUE)
export class BookMediaProcessor extends WorkerHost {
  private readonly logger = new Logger(BookMediaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly storytellers: StorytellersService,
    private readonly events: BookEventsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const bookId = this.extractBookId(job);
    try {
      switch (job.name) {
        case BookMediaJobName.CoverImage:
          await this.handleCover(job as Job<CoverImageJobData>);
          break;
        case BookMediaJobName.TitleAudio:
          await this.handleTitleAudio(job as Job<TitleAudioJobData>);
          break;
        case BookMediaJobName.PageImage:
          await this.handlePageImage(job as Job<PageImageJobData>);
          break;
        case BookMediaJobName.PageAudio:
          await this.handlePageAudio(job as Job<PageAudioJobData>);
          break;
        case BookMediaJobName.ChoiceImage:
          await this.handleChoiceImage(job as Job<ChoiceImageJobData>);
          break;
        default:
          this.logger.warn(`Unknown ${BOOK_MEDIA_QUEUE} job: ${job.name}`);
      }
      await this.maybeMarkReady(bookId);
    } finally {
      // Always notify, even if a handler failed — clients can refetch and
      // see partial progress (or the same state) and the worker will retry
      // independently via BullMQ.
      await this.events.publish(bookId);
    }
  }

  private async handleCover(job: Job<CoverImageJobData>): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: job.data.bookId },
      select: { id: true, coverImagePrompt: true, storyBible: true },
    });
    // Prefer the bible's coverImagePrompt (style+world+character baked in)
    // over the legacy column. Fall back to the legacy text for pre-bible
    // books so they still render.
    const bible = extractBible(book?.storyBible);
    const prompt = bible?.coverImagePrompt ?? book?.coverImagePrompt;
    if (!book || !prompt) {
      this.logger.warn(`Book ${job.data.bookId}: no coverImagePrompt`);
      return;
    }
    const { images } = await this.ai.generateImage({
      prompt,
      aspectRatio: '1:1',
    });
    const url = images[0]?.url;
    if (!url) throw new Error('Image provider returned no URL');

    const stored = await this.storage.uploadRemoteFile({
      url,
      key: this.storage.buildObjectKey('books', book.id, 'cover.jpg'),
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await this.prisma.book.update({
      where: { id: book.id },
      data: {
        coverImageUrl: stored.url,
        coverImageObjectKey: stored.key,
      },
    });
    this.logger.log(`Book ${book.id}: cover image ready`);
  }

  private async handleTitleAudio(job: Job<TitleAudioJobData>): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: job.data.bookId },
      select: {
        id: true,
        title: true,
        language: true,
        storyteller: true,
      },
    });
    if (!book) throw new Error(`Book ${job.data.bookId} not found`);

    const storyteller = await this.storytellers.findByLanguageAndIdentifier(
      book.language as Language,
      book.storyteller,
    );
    if (!storyteller) {
      throw new Error(
        `Storyteller "${book.storyteller}" not found for "${book.language}"`,
      );
    }

    const speech = await this.ai.generateSpeech({
      text: book.title,
      voice: storyteller.voice,
      model: storyteller.model,
      language: book.language as Language,
    });

    const stored = await this.storage.upload({
      key: this.storage.buildObjectKey('books', book.id, 'title.mp3'),
      body: Buffer.from(speech.audio),
      contentType: speech.contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await this.prisma.book.update({
      where: { id: book.id },
      data: {
        titleAudioUrl: stored.url,
        titleAudioObjectKey: stored.key,
      },
    });
    this.logger.log(`Book ${book.id}: title audio ready`);
  }

  private async handlePageImage(job: Job<PageImageJobData>): Promise<void> {
    const page = await this.prisma.bookPage.findUnique({
      where: { id: job.data.pageId },
      select: {
        id: true,
        bookId: true,
        pageNumber: true,
        imagePrompt: true,
        book: { select: { storyBible: true } },
      },
    });
    if (!page?.imagePrompt) {
      this.logger.warn(`Page ${job.data.pageId}: no imagePrompt`);
      return;
    }

    const bible = extractBible(page.book.storyBible);
    const prompt = bible
      ? composeImagePrompt(bible, page.imagePrompt)
      : page.imagePrompt;

    const { images } = await this.ai.generateImage({
      prompt,
      aspectRatio: '1:1',
    });
    const url = images[0]?.url;
    if (!url) throw new Error('Image provider returned no URL');

    const stored = await this.storage.uploadRemoteFile({
      url,
      key: this.storage.buildObjectKey(
        'books',
        page.bookId,
        'pages',
        `${page.pageNumber}-image.jpg`,
      ),
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await this.prisma.bookPage.update({
      where: { id: page.id },
      data: {
        imageUrl: stored.url,
        imageObjectKey: stored.key,
      },
    });
    this.logger.log(`Page ${page.id} (book ${page.bookId}): image ready`);
  }

  private async handlePageAudio(job: Job<PageAudioJobData>): Promise<void> {
    const page = await this.prisma.bookPage.findUnique({
      where: { id: job.data.pageId },
      select: {
        id: true,
        bookId: true,
        pageNumber: true,
        narrationText: true,
        book: { select: { language: true, storyteller: true } },
      },
    });
    if (!page) throw new Error(`Page ${job.data.pageId} not found`);

    const storyteller = await this.storytellers.findByLanguageAndIdentifier(
      page.book.language as Language,
      page.book.storyteller,
    );
    if (!storyteller) {
      throw new Error(
        `Storyteller "${page.book.storyteller}" not found for "${page.book.language}"`,
      );
    }

    const speech = await this.ai.generateSpeech({
      text: page.narrationText,
      voice: storyteller.voice,
      model: storyteller.model,
      language: page.book.language as Language,
    });

    const stored = await this.storage.upload({
      key: this.storage.buildObjectKey(
        'books',
        page.bookId,
        'pages',
        `${page.pageNumber}-audio.mp3`,
      ),
      body: Buffer.from(speech.audio),
      contentType: speech.contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await this.prisma.bookPage.update({
      where: { id: page.id },
      data: {
        audioUrl: stored.url,
        audioObjectKey: stored.key,
      },
    });
    this.logger.log(`Page ${page.id} (book ${page.bookId}): audio ready`);
  }

  private async handleChoiceImage(job: Job<ChoiceImageJobData>): Promise<void> {
    const choice = await this.prisma.bookChoice.findUnique({
      where: { id: job.data.choiceId },
      select: {
        id: true,
        bookPageId: true,
        choiceIndex: true,
        imagePrompt: true,
        bookPage: {
          select: {
            bookId: true,
            pageNumber: true,
            book: { select: { storyBible: true } },
          },
        },
      },
    });
    if (!choice?.imagePrompt) {
      this.logger.warn(`Choice ${job.data.choiceId}: no imagePrompt`);
      return;
    }

    const bible = extractBible(choice.bookPage.book.storyBible);
    const prompt = bible
      ? composeImagePrompt(bible, choice.imagePrompt)
      : choice.imagePrompt;

    const { images } = await this.ai.generateImage({
      prompt,
      aspectRatio: '1:1',
    });
    const url = images[0]?.url;
    if (!url) throw new Error('Image provider returned no URL');

    const stored = await this.storage.uploadRemoteFile({
      url,
      key: this.storage.buildObjectKey(
        'books',
        choice.bookPage.bookId,
        'pages',
        `${choice.bookPage.pageNumber}-choices`,
        `${choice.choiceIndex}.jpg`,
      ),
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await this.prisma.bookChoice.update({
      where: { id: choice.id },
      data: {
        imageUrl: stored.url,
        imageObjectKey: stored.key,
      },
    });
    this.logger.log(
      `Choice ${choice.id} (book ${choice.bookPage.bookId}, page ${choice.bookPage.pageNumber}, idx ${choice.choiceIndex}): image ready`,
    );
  }

  /**
   * Mark a book as `ready` once the cover image and the first page image
   * are stored. Per product decision: cover is a hard prerequisite. Audio
   * and remaining page images stream in afterwards but don't block "ready".
   */
  private async maybeMarkReady(bookId: string): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: {
        id: true,
        status: true,
        coverImageUrl: true,
        pages: {
          orderBy: { pageNumber: 'asc' },
          take: 1,
          select: { imageUrl: true },
        },
      },
    });
    if (!book || book.status === 'ready') return;
    const firstPageImage = book.pages[0]?.imageUrl;
    if (book.coverImageUrl && firstPageImage) {
      await this.prisma.book.update({
        where: { id: book.id },
        data: { status: 'ready' },
      });
      this.logger.log(`Book ${book.id}: status -> ready`);
    }
  }

  private extractBookId(job: Job): string {
    const data = job.data as { bookId?: string };
    if (!data.bookId) {
      throw new Error(`Job ${job.name} missing bookId`);
    }
    return data.bookId;
  }
}

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
