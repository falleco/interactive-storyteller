import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import type { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { USER_EVENTS_QUEUE } from '../queue/user-events.queue';
import { HEALTH_REDIS_CLIENT } from './health.tokens';

interface QueueStats {
  name: string;
  paused: boolean;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    prioritized: number;
    'waiting-children': number;
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly prisma: PrismaService,
    @Inject(HEALTH_REDIS_CLIENT) private readonly redisClient: Redis,
    @InjectQueue(USER_EVENTS_QUEUE) private readonly userEventsQueue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness and dependency health check' })
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('postgres', this.prisma),
      () =>
        this.redisIndicator.checkHealth('redis', {
          type: 'redis',
          client: this.redisClient,
        }),
    ]);
  }

  @Get('queues')
  @ApiOperation({
    summary: 'BullMQ queue counts for observability',
    description:
      'Returns job counts (waiting, active, completed, failed, delayed) and pause state for every registered queue.',
  })
  async queues(): Promise<{ queues: QueueStats[] }> {
    const queues: Queue[] = [this.userEventsQueue];
    const stats = await Promise.all(queues.map((q) => readQueueStats(q)));
    return { queues: stats };
  }
}

async function readQueueStats(queue: Queue): Promise<QueueStats> {
  const [counts, paused] = await Promise.all([
    queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'prioritized',
      'waiting-children',
    ),
    queue.isPaused(),
  ]);
  return {
    name: queue.name,
    paused,
    counts: {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      prioritized: counts.prioritized ?? 0,
      'waiting-children': counts['waiting-children'] ?? 0,
    },
  };
}
