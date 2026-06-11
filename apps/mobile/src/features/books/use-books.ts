import { useCallback, useEffect, useRef, useState } from 'react';
import EventSource from 'react-native-sse';
import { resolveApiBaseURL, useApi } from '~/shared/api';
import { useAuth } from '~/shared/hooks/use-auth';
import type {
  BookDetail,
  BookSummary,
  CreateBookInput,
  CreatedBookResponse,
} from './types';

export interface UseBooksResult {
  books: BookSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (input: CreateBookInput) => Promise<CreatedBookResponse>;
  completeRead: (id: string) => Promise<void>;
  completeGame: (input: {
    bookId: string;
    pageId: string;
    gameId: string;
  }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  chooseNext: (input: { bookId: string; choiceIndex: number }) => Promise<void>;
}

/**
 * Module-level pub-sub so multiple `useBooks` instances (library tab,
 * wonder-sheet wizard, family tab stats) stay in sync. Without this,
 * a `create` from the wonder-sheet only mutates its own local state
 * and the library has to wait for the next `useFocusEffect` tick to
 * notice — which feels like "I had to pull-to-refresh to see the
 * new story" from the user's perspective.
 */
const bookListeners = new Set<() => void>();
function notifyBooksChanged(): void {
  for (const listener of bookListeners) listener();
}

/**
 * Patcher pub-sub: a SECOND channel that lets a single book be updated
 * in-place across every mounted `useBooks` list without refetching.
 * Mainly fed by `useBookDetail`'s SSE snapshot stream — when the cover
 * image finishes rendering or the book flips status, those changes
 * land directly in the library list, so navigating back doesn't show
 * a stale "no cover" emoji until the user pulls to refresh.
 */
type BookPatchListener = (id: string, patch: Partial<BookSummary>) => void;
const bookPatchListeners = new Set<BookPatchListener>();
export function applyBookPatch(id: string, patch: Partial<BookSummary>): void {
  for (const listener of bookPatchListeners) listener(id, patch);
}

export function useBooks(): UseBooksResult {
  const api = useApi();
  const { user } = useAuth();
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setBooks([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.get<BookSummary[]>('/books');
      setBooks(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load books'));
    } finally {
      setIsLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Wake this instance whenever any other `useBooks` mutates the list
  // (create / remove). Re-fetches against the server so the optimistic
  // change made by another instance is reconciled with authoritative
  // data and ordering.
  useEffect(() => {
    const listener = () => {
      refresh();
    };
    bookListeners.add(listener);
    return () => {
      bookListeners.delete(listener);
    };
  }, [refresh]);

  // Targeted in-place patches (e.g. cover image arrived for an
  // in-flight book via SSE). Avoids re-fetching the whole list — the
  // patch payload is whatever fields the snapshot stream pushes.
  useEffect(() => {
    const listener: BookPatchListener = (id, patch) => {
      setBooks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      );
    };
    bookPatchListeners.add(listener);
    return () => {
      bookPatchListeners.delete(listener);
    };
  }, []);

  const create = useCallback(
    async (input: CreateBookInput) => {
      const created = await api.post<CreatedBookResponse>('/books', input);
      // Optimistic prepend; the next refresh will reconcile with server state.
      setBooks((prev) => [
        {
          id: created.id,
          title: created.title,
          status: created.status,
          mode: created.mode,
          language: created.language,
          storyteller: created.storyteller,
          coverImageUrl: null,
          pageCount: created.pageCount,
          completedReadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      notifyBooksChanged();
      return created;
    },
    [api],
  );

  const completeRead = useCallback(
    async (id: string) => {
      await api.post<void>(`/books/${id}/complete-read`);
    },
    [api],
  );

  const completeGame = useCallback(
    async (input: { bookId: string; pageId: string; gameId: string }) => {
      await api.post<void>(
        `/books/${input.bookId}/pages/${input.pageId}/game/complete`,
        {
          gameId: input.gameId,
          completed: true,
          score: 1,
          total: 1,
        },
      );
    },
    [api],
  );

  const chooseNext = useCallback(
    async (input: { bookId: string; choiceIndex: number }) => {
      await api.post<BookDetail>(`/books/${input.bookId}/choice`, {
        choiceIndex: input.choiceIndex,
      });
    },
    [api],
  );

  const remove = useCallback(
    async (id: string) => {
      await api.delete<void>(`/books/${id}`);
      setBooks((prev) => prev.filter((b) => b.id !== id));
      notifyBooksChanged();
    },
    [api],
  );

  return {
    books,
    isLoading,
    error,
    refresh,
    create,
    completeRead,
    completeGame,
    remove,
    chooseNext,
  };
}

interface UseBookDetailResult {
  book: BookDetail | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

type BookSseEventName = 'snapshot' | 'ping';

/**
 * Stream a single book over Server-Sent Events from `GET /books/:id/events`.
 * The endpoint pushes a full BookDetail snapshot whenever the backend writes
 * a change (media stored, status flip, new interactive page appended), so we
 * don't need to poll.
 *
 * `refetch` does a one-shot GET — useful right after a mutating action
 * (e.g. chooseNext) for callers that prefer not to wait for the next pushed
 * snapshot.
 */
export function useBookDetail(
  bookId: string | null | undefined,
): UseBookDetailResult {
  const api = useApi();
  const { bearerToken } = useAuth();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource<BookSseEventName> | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!bookId) {
      setBook(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const detail = await api.get<BookDetail>(`/books/${bookId}`);
      setBook(detail);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load book'));
    } finally {
      setIsLoading(false);
    }
  }, [api, bookId]);

  useEffect(() => {
    if (!bookId || !bearerToken) {
      setBook(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const url = `${resolveApiBaseURL()}/books/${bookId}/events`;
    const es = new EventSource<BookSseEventName>(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      // react-native-sse defaults are fine; the library reconnects on its own.
    });
    eventSourceRef.current = es;

    es.addEventListener('snapshot', (event) => {
      if (!event.data) return;
      try {
        const detail = JSON.parse(event.data) as BookDetail;
        setBook(detail);
        setIsLoading(false);
        // Mirror the BookSummary-shaped fields into any open `useBooks`
        // list — so when the cover image finishes rendering or the
        // status flips, the library/family screens already have the
        // fresh data when the user navigates back.
        applyBookPatch(detail.id, {
          title: detail.title,
          status: detail.status,
          coverImageUrl: detail.coverImageUrl,
          pageCount: detail.pageCount,
          completedReadCount: detail.completedReadCount,
          updatedAt: detail.updatedAt,
        });
      } catch (e) {
        setError(
          e instanceof Error ? e : new Error('Bad SSE payload from server'),
        );
      }
    });

    es.addEventListener('error', (event) => {
      // The library auto-reconnects, so we surface the latest error without
      // tearing down — once a reconnect succeeds the user gets data again.
      const message =
        'message' in event && typeof event.message === 'string'
          ? event.message
          : 'Lost connection to the book stream';
      setError(new Error(message));
      setIsLoading(false);
    });

    return () => {
      es.removeAllEventListeners();
      es.close();
      eventSourceRef.current = null;
    };
  }, [bookId, bearerToken]);

  return { book, isLoading, error, refetch: fetchOnce };
}
