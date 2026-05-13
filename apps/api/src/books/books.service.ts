import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Book, BookChoice, BookPage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface BookSummary {
  id: string;
  title: string;
  status: string;
  mode: string;
  language: string;
  storyteller: string;
  coverImageUrl: string | null;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
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
  title: string;
  content: string;
  narrationText: string;
  imageUrl: string | null;
  audioUrl: string | null;
  choices: BookChoicePayload[];
}

export interface BookDetail extends BookSummary {
  characterDescription: string | null;
  titleAudioUrl: string | null;
  pages: BookPagePayload[];
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  listForUser(userId: string): Promise<BookSummary[]> {
    return this.prisma.book
      .findMany({
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
          createdAt: true,
          updatedAt: true,
        },
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      );
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
    if (!book) throw new NotFoundException('Book not found');
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
    coverImageUrl: book.coverImageUrl,
    pageCount: book.pageCount,
    characterDescription: book.characterDescription,
    titleAudioUrl: book.titleAudioUrl,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
    pages: book.pages.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      title: p.title,
      content: p.content,
      narrationText: p.narrationText,
      imageUrl: p.imageUrl,
      audioUrl: p.audioUrl,
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
