export const BOOK_MEDIA_QUEUE = 'book-media';

export const BookMediaJobName = {
  CoverImage: 'book.cover-image',
  TitleAudio: 'book.title-audio',
  PageImage: 'book.page-image',
  PageAudio: 'book.page-audio',
  ChoiceImage: 'book.choice-image',
} as const;

export type BookMediaJobName =
  (typeof BookMediaJobName)[keyof typeof BookMediaJobName];

export interface CoverImageJobData {
  bookId: string;
}

export interface TitleAudioJobData {
  bookId: string;
}

export interface PageImageJobData {
  bookId: string;
  pageId: string;
}

export interface PageAudioJobData {
  bookId: string;
  pageId: string;
}

export interface ChoiceImageJobData {
  bookId: string;
  choiceId: string;
}
