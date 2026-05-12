import { Queue } from 'bullmq';

export const USER_EVENTS_QUEUE = 'user-events';

export const UserEventJobName = {
  Created: 'user.created',
} as const;

export type UserEventJobName =
  (typeof UserEventJobName)[keyof typeof UserEventJobName];

export interface UserCreatedJobData {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
}

/**
 * Standalone Queue instance used to publish jobs from contexts that are not
 * managed by NestJS DI — namely the Better Auth `databaseHooks` callbacks
 * that fire inside the auth handler. The NestJS Worker (UserEventsProcessor)
 * consumes from the same Redis queue.
 */
let publisher: Queue | null = null;

function readRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('Missing required env var: REDIS_URL');
  }
  return url;
}

export function getUserEventsQueue(): Queue {
  if (!publisher) {
    publisher = new Queue(USER_EVENTS_QUEUE, {
      connection: { url: readRedisUrl() },
    });
  }
  return publisher;
}
