import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  USER_EVENTS_QUEUE,
  type UserCreatedJobData,
  UserEventJobName,
} from './user-events.queue';

@Processor(USER_EVENTS_QUEUE)
export class UserEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(UserEventsProcessor.name);

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case UserEventJobName.Created:
        await this.handleUserCreated(job as Job<UserCreatedJobData>);
        return;
      default:
        this.logger.warn(`Unknown job in ${USER_EVENTS_QUEUE}: ${job.name}`);
    }
  }

  private async handleUserCreated(job: Job<UserCreatedJobData>): Promise<void> {
    const { userId, email, name, image, emailVerified, createdAt } = job.data;
    this.logger.log(
      `User created: id=${userId} email=${email} name=${name ?? '∅'} verified=${emailVerified} image=${image ?? '∅'} at=${createdAt}`,
    );
    // TODO: expand — provision profile, send welcome email, etc.
  }
}
