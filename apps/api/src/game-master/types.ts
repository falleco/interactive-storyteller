import type {
  AvailableStoryGame,
  StoryGameDescriptor,
} from '@wondertales/shared/games';
import type { TextUsage } from '../ai/types';
import type { Language } from '../storytellers/storyteller-catalog';

/**
 * Canonical "story bible" for a book: the consistent context every page and
 * every image prompt is anchored to. Generated once at book creation and
 * reused by every subsequent LLM call + image render.
 */
export interface StoryBible {
  /** The book title — kept here so callers can extract it without a duplicate field. */
  title: string;
  /** Setting description: places, lighting, colors, suns/moons, atmosphere. */
  world: string;
  /**
   * Detailed visual + behavioral description of the protagonist (species,
   * age, clothing with specific colors, accessories, mood). Stays fixed for
   * the whole book.
   */
  mainCharacters: string;
  /**
   * Supporting cast — names, how they look, key traits. Empty string when
   * the story has no notable secondary characters yet (they may appear
   * organically per page).
   */
  otherCharacters: string;
  /**
   * Art + narrative style guidance, picked to match the target child's age
   * and the theme (e.g. "soft crayon-style illustrations for toddlers" or
   * "pastel fairy-tale watercolor").
   */
  style: string;
  /** What the story is fundamentally about: friendship, courage, learning, etc. */
  theme: string;
  /**
   * Full ready-to-render cover image prompt, already incorporating style +
   * world + main character details. Sent verbatim to the image model.
   */
  coverImagePrompt: string;
}

export interface StoryPage {
  title: string;
  content: string;
  /**
   * Scene-specific image prompt (what happens on this page). The book-media
   * processor composes the final image prompt by prefixing the bible's
   * style + world + mainCharacters context.
   */
  imagePrompt: string;
  /** Optional minigame that must be completed before the story continues. */
  game?: StoryGameDescriptor;
}

export interface GeneratedStoryBible {
  bible: StoryBible;
  usage?: TextUsage;
}

export interface GenerateStoryBibleInput {
  language: Language;
  /** Theme/topic for the story (free text from the user). */
  theme?: string;
  /** Child profile snapshot — name, age, optional gender. */
  child?: {
    name: string;
    age: number;
    gender?: string | null;
  };
}

export interface GeneratedStory {
  pages: StoryPage[];
  /** Token usage from the LLM call. */
  usage?: TextUsage;
}

export interface GenerateClassicStoryInput extends GenerateStoryBibleInput {
  /** Canonical bible the pages must stay consistent with. */
  bible: StoryBible;
}

export interface GenerateMagicStoryInput extends GenerateStoryBibleInput {
  /** Canonical bible the pages must stay consistent with. */
  bible: StoryBible;
  /** Games the LLM may weave into the story. Internal/test games are excluded. */
  availableGames: AvailableStoryGame[];
}

/** A past page + which choice was taken. Fed back to the LLM as history. */
export interface InteractivePageHistory {
  title: string;
  content: string;
  /** The label of the choice the reader picked (undefined if last page). */
  selectedChoiceLabel?: string;
}

export interface InteractiveChoice {
  label: string;
  imagePrompt: string;
}

export interface GeneratedInteractivePage {
  title: string;
  content: string;
  imagePrompt: string;
  /** Empty on the final page (last page resolves the story). */
  choices: InteractiveChoice[];
  usage?: TextUsage;
}

export interface GenerateInteractivePageInput extends GenerateStoryBibleInput {
  /** Canonical bible the page must stay consistent with. */
  bible: StoryBible;
  /** Previous pages with their resolved choice (when applicable). */
  previousPages?: InteractivePageHistory[];
}
