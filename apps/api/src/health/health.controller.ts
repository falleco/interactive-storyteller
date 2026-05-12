import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { HEALTH_REDIS_CLIENT } from './health.tokens';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly prisma: PrismaService,
    @Inject(HEALTH_REDIS_CLIENT) private readonly redisClient: Redis,
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
}
