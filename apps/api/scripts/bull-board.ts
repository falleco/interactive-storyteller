import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import * as dotenv from 'dotenv';
import express from 'express';
import { BOOK_MEDIA_QUEUE } from '../src/books/book-media.queue';
import { USER_EVENTS_QUEUE } from '../src/queue/user-events.queue';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error('REDIS_URL must be set (check apps/api/.env).');
  process.exit(1);
}

const BULL_BOARD_PORT = Number.parseInt(
  process.env.BULL_BOARD_PORT ?? '4100',
  10,
);
const BULL_BOARD_PATH = process.env.BULL_BOARD_PATH ?? '/admin/queues';

const QUEUE_NAMES = [BOOK_MEDIA_QUEUE, USER_EVENTS_QUEUE] as const;

async function main() {
  const queues = QUEUE_NAMES.map(
    (name) => new Queue(name, { connection: { url: REDIS_URL } }),
  );

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  const app = express();
  app.use(BULL_BOARD_PATH, serverAdapter.getRouter());
  app.get('/', (_req, res) => res.redirect(BULL_BOARD_PATH));

  const server = app.listen(BULL_BOARD_PORT, () => {
    console.log(
      `Bull Board ready at http://localhost:${BULL_BOARD_PORT}${BULL_BOARD_PATH}`,
    );
    console.log(
      `Watching queues: ${QUEUE_NAMES.join(', ')} on ${REDIS_URL}`,
    );
  });

  const shutdown = async () => {
    console.log('\nShutting down Bull Board…');
    server.close();
    await Promise.allSettled(queues.map((q) => q.close()));
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Bull Board failed to start:', error);
  process.exit(1);
});
