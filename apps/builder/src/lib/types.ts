import type { StoryGameDescriptor } from '@wondertales/shared/games';
import type { NarrationBlock } from '@wondertales/shared/stories';
import {
  type Language,
  STORYTELLER_CATALOG,
  SUPPORTED_LANGUAGES,
} from '@wondertales/shared/storytellers';

export { SUPPORTED_LANGUAGES };
export type BuilderLanguage = Language;

export const LANGUAGE_LABELS: Record<BuilderLanguage, string> = {
  en: 'English',
  fr: 'French',
  pt: 'Portuguese',
  it: 'Italian',
};

export const STORYTELLERS = STORYTELLER_CATALOG.map(
  (storyteller) => storyteller.identifier,
);

export const VOICE_PRESETS = STORYTELLER_CATALOG.map((storyteller) => ({
  id: storyteller.identifier,
  label: storyteller.names.en,
  inworldVoiceId: storyteller.voice,
  model: storyteller.model,
  deliveryMode: storyteller.deliveryMode,
  speechInstruction: storyteller.speechInstruction,
}));

export type BuilderVoice = (typeof STORYTELLER_CATALOG)[number]['identifier'];
export type BuilderNarrationBlock = NarrationBlock;

export type BuilderBookStatus =
  | 'draft'
  | 'generating'
  | 'published'
  | 'archived'
  | 'failed';

export type BuilderBookPhase = 'text' | 'images' | 'audio' | 'ready';
export type BuilderPageType = 'story' | 'game';
export type BuilderImageAspect = 'desktop' | 'tablet' | 'phone';

export const DEFAULT_IMAGE_ASPECT = 'phone' satisfies BuilderImageAspect;

export const IMAGE_ASPECT_OPTIONS = [
  {
    id: 'desktop',
    label: 'Desktop',
    description: 'Landscape',
    size: '1536x1024',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    description: '4:3',
    size: '1280x960',
  },
  {
    id: 'phone',
    label: 'Phone',
    description: 'Portrait',
    size: '1024x1536',
  },
] as const satisfies ReadonlyArray<{
  id: BuilderImageAspect;
  label: string;
  description: string;
  size: string;
}>;

export type BuilderBookLocalization = {
  title: string;
  summary: string;
};

export type BuilderPageLocalization = {
  content: string;
  contentHtml: string;
  narrationText: string;
  narrationHtml: string;
  narrationBlocks: BuilderNarrationBlock[];
  audioUrl: string;
};

export type BuilderCharacter = {
  id: string;
  name: string;
  imageUrl: string;
  role: string;
  appearance: string;
  details: string;
};

export type BuilderPagePayload = {
  id: string;
  pageNumber: number;
  pageType: BuilderPageType;
  imageAspect: BuilderImageAspect;
  imagePrompt: string;
  imageUrl: string;
  characterIds: string[];
  game: StoryGameDescriptor | null;
  localizations: Record<BuilderLanguage, BuilderPageLocalization>;
};

export type BuilderBookPayload = {
  id: string;
  slug: string;
  status: BuilderBookStatus;
  builderPhase: BuilderBookPhase;
  baseLanguage: BuilderLanguage;
  storyteller: string;
  defaultVoice: string;
  ageMin: number;
  ageMax: number;
  prompt: string;
  stylePrompt: string;
  imageAspect: BuilderImageAspect;
  coverImagePrompt: string;
  coverCharacterIds: string[];
  coverImageUrl: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  characters: BuilderCharacter[];
  localizations: Record<BuilderLanguage, BuilderBookLocalization>;
  pages: BuilderPagePayload[];
};

export type BuilderBookSummary = Pick<
  BuilderBookPayload,
  | 'id'
  | 'slug'
  | 'status'
  | 'builderPhase'
  | 'coverImageUrl'
  | 'publishedAt'
  | 'updatedAt'
  | 'localizations'
> & {
  pageCount: number;
};
