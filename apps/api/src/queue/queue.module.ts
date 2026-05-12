import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppConfigurationType } from '../config/configuration';
import { UserEventsProcessor } from './user-events.processor';
import { USER_EVENTS_QUEUE } from './user-events.queue';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfigurationType, true>) => ({
        connection: {
          url: config.getOrThrow('redis', { infer: true }).url,
        },
      }),
    }),
    BullModule.registerQueue({ name: USER_EVENTS_QUEUE }),
  ],
  providers: [UserEventsProcessor],
  exports: [BullModule],
})
export class QueueModule {}
