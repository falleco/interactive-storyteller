import { Module } from '@nestjs/common';
import { BookEventsService } from './book-events.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [],
  controllers: [BooksController],
  providers: [BooksService, BookEventsService],
  exports: [BooksService],
})
export class BooksModule {}
