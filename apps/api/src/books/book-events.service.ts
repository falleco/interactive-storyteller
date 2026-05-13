import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import type { AppConfigurationType } from '../config/configuration';

const CHANNEL_PREFIX = 'book-events:';

function channelFor(bookId: string): string {
  return `${CHANNEL_PREFIX}${bookId}`;
}

/**
 * Lightweight Redis pub/sub for "book updated" notifications. Notifications
 * carry no payload — listeners refetch the book to get the fresh state. This
 * keeps the protocol simple and avoids sending stale snapshots over Redis.
 *
 * One subscriber connection per process pattern-subscribes to all book
 * channels and dispatches to an in-memory Subject per bookId. SSE handlers
 * call `subscribe(bookId)` to get an Observable.
 */
@Injectable()
export class BookEventsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BookEventsService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly subjects = new Map<string, Subject<void>>();

  constructor(config: ConfigService<AppConfigurationType, true>) {
    const url = config.getOrThrow('redis', { infer: true }).url;
    this.publisher = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
    });
    this.subscriber = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on('pmessage', (_pattern, channel) => {
      if (!channel.startsWith(CHANNEL_PREFIX)) return;
      const bookId = channel.slice(CHANNEL_PREFIX.length);
      this.subjects.get(bookId)?.next();
    });
    await this.subscriber.psubscribe(`${CHANNEL_PREFIX}*`);
    this.logger.log(`Subscribed to ${CHANNEL_PREFIX}* on Redis`);
  }

  async onApplicationShutdown(): Promise<void> {
    for (const subject of this.subjects.values()) {
      subject.complete();
    }
    this.subjects.clear();
    await Promise.allSettled([
      safeQuit(this.subscriber),
      safeQuit(this.publisher),
    ]);
  }

  async publish(bookId: string): Promise<void> {
    try {
      await this.publisher.publish(channelFor(bookId), '1');
    } catch (e) {
      // Don't let pub/sub failures break the originating write — they'd only
      // degrade real-time UX. Log and move on; clients still receive updates
      // via their own reconnect/fetch fallbacks.
      this.logger.warn(
        `Failed to publish book event for ${bookId}: ${(e as Error).message}`,
      );
    }
  }

  subscribe(bookId: string): Observable<void> {
    const existing = this.subjects.get(bookId);
    if (existing) return existing.asObservable();
    const subject = new Subject<void>();
    this.subjects.set(bookId, subject);
    return subject.asObservable();
  }
}

async function safeQuit(client: Redis): Promise<void> {
  if (client.status === 'end') return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
