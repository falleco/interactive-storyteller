import { RedisHealthModule } from '@liaoliaots/nestjs-redis-health';
import { BullModule } from '@nestjs/bullmq';
import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import Redis from 'ioredis';
import type { AppConfigurationType } from '../config/configuration';
import { USER_EVENTS_QUEUE } from '../queue/user-events.queue';
import { HealthController } from './health.controller';
import { HEALTH_REDIS_CLIENT } from './health.tokens';

@Module({
  imports: [
    TerminusModule,
    RedisHealthModule,
    BullModule.registerQueue({ name: USER_EVENTS_QUEUE }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfigurationType, true>) => {
        const url = config.getOrThrow('redis', { infer: true }).url;
        return new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1 });
      },
    },
  ],
})
export class HealthModule implements OnApplicationShutdown {
  constructor(
    @Inject(HEALTH_REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redisClient.status === 'end') {
      return;
    }
    try {
      await this.redisClient.quit();
    } catch {
      this.redisClient.disconnect();
    }
  }
}
