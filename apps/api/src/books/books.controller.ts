import {
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { isLanguage } from '../storytellers/storyteller-catalog';
import { BookEventsService } from './book-events.service';
import type { BookDetail } from './books.service';
import { BooksService } from './books.service';
import { CompleteGameDto } from './dto/complete-game.dto';

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
    private readonly events: BookEventsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my books' })
  list(
    @CurrentUser() user: PublicUser,
    @Query('language') language?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.books.listForUser(user.id, {
      language: resolveCatalogLanguage(language, acceptLanguage),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a book with pages (player payload)' })
  get(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Query('language') language?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.books.getVisibleDetailOrThrow({
      id,
      userId: user.id,
      language: resolveCatalogLanguage(language, acceptLanguage),
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Deprecated: on-demand book creation is no longer available',
    description:
      'Wonder Tales now serves only pre-created published books from the curated catalog.',
  })
  create() {
    throw new GoneException(
      'On-demand story creation is no longer available. Use the published book catalog.',
    );
  }

  @Post(':id/choice')
  @ApiOperation({
    summary: 'Deprecated: on-demand branching is no longer available',
    description:
      'Interactive branches are no longer generated at read time. All story content is pre-created.',
  })
  chooseNext() {
    throw new GoneException(
      'On-demand story branching is no longer available. Books are fully pre-created.',
    );
  }

  @Post(':id/pages/:pageId/game/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Mark a magic-mode page minigame as completed',
    description:
      'Unlocks the following story pages in the mobile player. The book stream emits a fresh snapshot after completion.',
  })
  async completeGame(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @Body() dto: CompleteGameDto,
  ) {
    const isCuratedGame = await this.books.hasPublishedCuratedPageGame({
      bookId: id,
      pageId,
      gameId: dto.gameId,
    });
    if (isCuratedGame) return;
    throw new GoneException(
      'Runtime-generated story games are no longer supported.',
    );
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
    @Query('language') language?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Observable<BookSseEvent> {
    const catalogLanguage = resolveCatalogLanguage(language, acceptLanguage);
    // The initial fetch also validates ownership — if it throws, NestJS
    // converts the rejection into an error before the stream opens.
    const fetchSnapshot = () =>
      this.books.getVisibleDetailOrThrow({
        id,
        userId: user.id,
        language: catalogLanguage,
      });

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

function resolveCatalogLanguage(
  requestedLanguage: string | undefined,
  acceptLanguage: string | undefined,
): string {
  if (requestedLanguage && isLanguage(requestedLanguage)) {
    return requestedLanguage;
  }
  for (const part of acceptLanguage?.split(',') ?? []) {
    const code = part.trim().split(';')[0]?.split('-')[0];
    if (code && isLanguage(code)) return code;
  }
  return 'en';
}
