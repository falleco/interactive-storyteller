import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { StoryTemplatesModule } from '../story-templates/story-templates.module';
import { StorytellersModule } from '../storytellers/storytellers.module';
import { BookEventsService } from './book-events.service';
import { BookGenerationService } from './book-generation.service';
import { BookMediaProcessor } from './book-media.processor';
import { BOOK_MEDIA_QUEUE } from './book-media.queue';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [
    StorytellersModule,
    StoryTemplatesModule,
    BullModule.registerQueue({ name: BOOK_MEDIA_QUEUE }),
  ],
  controllers: [BooksController],
  providers: [
    BooksService,
    BookGenerationService,
    BookMediaProcessor,
    BookEventsService,
  ],
  exports: [BooksService],
})
export class BooksModule {}
