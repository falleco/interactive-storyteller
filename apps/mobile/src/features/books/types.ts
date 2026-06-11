import type { StoryGameDescriptor } from '@wondertales/shared/games';
import type { Language } from '../storytellers';

export type BookStatus = 'draft' | 'generating' | 'ready' | 'failed';
export type BookMode = 'classic' | 'interactive' | 'magic';

/**
 * Total pages for an interactive story — when reached, no more choices are
 * shown and the player advances to the end slide. Mirrors STORY_PAGE_COUNT on
 * the API side.
 */
export const STORY_PAGE_COUNT = 5;

export interface BookSummary {
  id: string;
  title: string;
  status: BookStatus;
  mode: BookMode;
  language: Language;
  storyteller: string;
  coverImageUrl: string | null;
  pageCount: number;
  /** Number of times the user has marked this book as fully read. */
  completedReadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookChoice {
  id: string;
  choiceIndex: number;
  label: string;
  imageUrl: string | null;
  selected: boolean;
}

export interface BookPagePayload {
  id: string;
  pageNumber: number;
  title: string;
  content: string;
  narrationText: string;
  imageUrl: string | null;
  audioUrl: string | null;
  game: StoryGameDescriptor | null;
  gameCompletedAt: string | null;
  choices: BookChoice[];
}

export interface BookDetail extends BookSummary {
  characterDescription: string | null;
  titleAudioUrl: string | null;
  pages: BookPagePayload[];
}

export interface CreateBookInput {
  mode: BookMode;
  language: Language;
  storyteller: string;
  /** Free-form theme. Ignored when `templateId` is provided. */
  theme?: string;
  /** Story template id — server resolves its prompt text from the database. */
  templateId?: string;
  childProfileId?: string;
}

export interface CreatedBookResponse {
  id: string;
  title: string;
  status: BookStatus;
  mode: BookMode;
  language: Language;
  storyteller: string;
  pageCount: number;
}
