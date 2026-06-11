import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PublicUser } from '@wondertales/shared';
import {
  concat,
  defer,
  from,
  interval,
  map,
  merge,
  type Observable,
  switchMap,
} from 'rxjs';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { BookEventsService } from './book-events.service';
import { BookGenerationService } from './book-generation.service';
import type { BookDetail } from './books.service';
import { BooksService } from './books.service';
import { ChooseNextDto } from './dto/choose-next.dto';
import { CompleteGameDto } from './dto/complete-game.dto';
import { CreateBookDto } from './dto/create-book.dto';

interface BookSseEvent {
  data: BookDetail | { type: 'ping' };
  type: 'snapshot' | 'ping';
}

const SSE_HEARTBEAT_MS = 30_000;

@ApiTags('books')
@Controller('books')
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class BooksController {
  constructor(
    private readonly books: BooksService,
    private readonly generation: BookGenerationService,
    private readonly events: BookEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my books' })
  list(@CurrentUser() user: PublicUser) {
    return this.books.listForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a book with pages (player payload)' })
  get(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.books.getOwnedDetailOrThrow({ id, userId: user.id });
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new book and kick off generation',
    description:
      'Returns the book immediately with status="generating". Media (cover, audio, page images) renders asynchronously; poll GET /books/:id until status="ready". Interactive mode generates page 1 up-front and uses POST /books/:id/choice to append pages. Magic mode generates a full linear story with one minigame gate.',
  })
  async create(@CurrentUser() user: PublicUser, @Body() dto: CreateBookDto) {
    const params = {
      userId: user.id,
      language: dto.language,
      storyteller: dto.storyteller,
      theme: dto.theme,
      templateId: dto.templateId,
      childProfileId: dto.childProfileId ?? null,
    };
    const book =
      dto.mode === 'interactive'
        ? await this.generation.createInteractive(params)
        : dto.mode === 'magic'
          ? await this.generation.createMagic(params)
          : await this.generation.createClassic(params);
    return {
      id: book.id,
      title: book.title,
      status: book.status,
      mode: book.mode,
      language: book.language,
      storyteller: book.storyteller,
      pageCount: book.pageCount,
    };
  }

  @Post(':id/choice')
  @ApiOperation({
    summary: 'Pick a choice on the latest page of an interactive book',
    description:
      'Generates the next page using the chosen path. Returns the full book detail with the new page included (still generating media). Idempotent guard: rejects when a choice is already selected on the latest page.',
  })
  async chooseNext(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Body() dto: ChooseNextDto,
  ) {
    await this.generation.continueInteractive({
      bookId: id,
      userId: user.id,
      choiceIndex: dto.choiceIndex,
    });
    return this.books.getOwnedDetailOrThrow({ id, userId: user.id });
  }

  @Post(':id/pages/:pageId/game/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark a magic-mode page minigame as completed',
    description:
      'Unlocks the following story pages in the mobile player. The book stream emits a fresh snapshot after completion.',
  })
  async completeGame(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @Body() dto: CompleteGameDto,
  ) {
    await this.generation.completeMagicGame({
      bookId: id,
      userId: user.id,
      pageId,
      result: dto.gameId
        ? {
            gameId: dto.gameId,
            completed: dto.completed ?? true,
            score: dto.score ?? 1,
            total: dto.total ?? 1,
          }
        : undefined,
    });
  }

  @Post(':id/complete-read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a book read-through as completed' })
  async completeRead(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    await this.books.incrementCompletedRead({ id, userId: user.id });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a book the current user owns' })
  async remove(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    await this.books.deleteOwned({ id, userId: user.id });
  }

  @Sse(':id/events')
  @ApiOperation({
    summary: 'Stream book updates over Server-Sent Events',
    description:
      'Pushes a fresh BookDetail snapshot ("snapshot" event) whenever the backend writes a change for this book. A "ping" event fires every 30s to keep the connection alive. Use this instead of polling GET /books/:id.',
  })
  stream(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
  ): Observable<BookSseEvent> {
    // The initial fetch also validates ownership — if it throws, NestJS
    // converts the rejection into an error before the stream opens.
    const fetchSnapshot = () =>
      this.books.getOwnedDetailOrThrow({ id, userId: user.id });

    const snapshots$: Observable<BookSseEvent> = concat(
      defer(() => from(fetchSnapshot())),
      this.events
        .subscribe(id)
        .pipe(switchMap(() => defer(() => from(fetchSnapshot())))),
    ).pipe(map((book): BookSseEvent => ({ type: 'snapshot', data: book })));

    const heartbeat$: Observable<BookSseEvent> = interval(
      SSE_HEARTBEAT_MS,
    ).pipe(map((): BookSseEvent => ({ type: 'ping', data: { type: 'ping' } })));

    return merge(snapshots$, heartbeat$);
  }
}
