/**
 * Curated list of storytellers. Same catalog used by the web project — names
 * are translated per supported language. Voice IDs come from Minimax's
 * speech-2.8-turbo model on Replicate.
 */

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'pt', 'it'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_STORYTELLER_IDENTIFIER = 'sparkle';
export const DEFAULT_STORYTELLER_MODEL = 'minimax/speech-2.8-turbo';

export interface StorytellerCatalogEntry {
  identifier: string;
  names: Record<Language, string>;
  voice: string;
  model: string;
  sortOrder: number;
}

export const STORYTELLER_CATALOG: readonly StorytellerCatalogEntry[] = [
  {
    identifier: 'sparkle',
    names: { en: 'Sparkle', fr: 'Étincelle', pt: 'Faísca', it: 'Scintilla' },
    voice: 'Lively_Girl',
    model: DEFAULT_STORYTELLER_MODEL,
    sortOrder: 10,
  },
  {
    identifier: 'breeze',
    names: { en: 'Breeze', fr: 'Brise', pt: 'Brisa', it: 'Brezza' },
    voice: 'Decent_Boy',
    model: DEFAULT_STORYTELLER_MODEL,
    sortOrder: 20,
  },
  {
    identifier: 'star',
    names: { en: 'Star', fr: 'Étoile', pt: 'Estrela', it: 'Stella' },
    voice: 'Inspirational_girl',
    model: DEFAULT_STORYTELLER_MODEL,
    sortOrder: 30,
  },
  {
    identifier: 'firework',
    names: {
      en: 'Firework',
      fr: "Feu d'artifice",
      pt: 'Foguinho',
      it: 'Fuoco',
    },
    voice: 'Exuberant_Girl',
    model: DEFAULT_STORYTELLER_MODEL,
    sortOrder: 40,
  },
  {
    identifier: 'thunder',
    names: { en: 'Thunder', fr: 'Tonnerre', pt: 'Trovão', it: 'Tuono' },
    voice: 'Deep_Voice_Man',
    model: DEFAULT_STORYTELLER_MODEL,
    sortOrder: 50,
  },
  {
    identifier: 'noble',
    names: { en: 'Noble', fr: 'Noble', pt: 'Nobre', it: 'Nobile' },
    voice: 'Elegant_Man',
    model: DEFAULT_STORYTELLER_MODEL,
    sortOrder: 60,
  },
] as const;

/** Build a storyteller portrait URL — host once we ship a CDN; placeholder for now. */
export function getStorytellerPortraitUrl(identifier: string): string {
  return `https://placeholder.invalid/storytellers/${identifier}.svg`;
}

/** Build a preview-audio URL per language and storyteller. */
export function getStorytellerPreviewAudioUrl(
  language: Language,
  identifier: string,
): string {
  return `https://placeholder.invalid/storytellers/${language}/${identifier}/preview.mp3`;
}

export function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
