import type { StoryGameDescriptor } from '@wondertales/shared/games';
import type { NarrationBlock } from '@wondertales/shared/stories';
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
  defaultVoice: string;
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
  pageType?: 'story' | 'game';
  title: string;
  content: string;
  narrationText: string;
  narrationBlocks: NarrationBlock[];
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
