export const SUPPORTED_LANGUAGES = ['en', 'fr', 'pt', 'it'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_STORYTELLER_IDENTIFIER = 'sparkle';
export const DEFAULT_INWORLD_TTS_MODEL = 'inworld-tts-2';
export const DEFAULT_INWORLD_TTS_LANGUAGE = 'en-US';
export const DEFAULT_INWORLD_AUDIO_ENCODING = 'MP3';
export const DEFAULT_INWORLD_SAMPLE_RATE = 48000;

export const INWORLD_LANGUAGE_TAGS = {
  en: 'en-US',
  fr: 'fr-FR',
  pt: 'pt-BR',
  it: 'it-IT',
} as const satisfies Record<Language, string>;

export type InworldDeliveryMode = 'STABLE' | 'BALANCED' | 'CREATIVE';

export interface StorytellerCatalogEntry {
  identifier: string;
  names: Record<Language, string>;
  voice: string;
  model: typeof DEFAULT_INWORLD_TTS_MODEL;
  deliveryMode: InworldDeliveryMode;
  speechInstruction: string;
  sortOrder: number;
}

export const STORYTELLER_CATALOG = [
  {
    identifier: 'sparkle',
    names: { en: 'Sparkle', fr: 'Etincelle', pt: 'Faisca', it: 'Scintilla' },
    voice: 'Ashley',
    model: DEFAULT_INWORLD_TTS_MODEL,
    deliveryMode: 'BALANCED',
    speechInstruction:
      '[say warmly with a bright, playful tone and a gentle pace]',
    sortOrder: 10,
  },
  {
    identifier: 'breeze',
    names: { en: 'Breeze', fr: 'Brise', pt: 'Brisa', it: 'Brezza' },
    voice: 'Dennis',
    model: DEFAULT_INWORLD_TTS_MODEL,
    deliveryMode: 'STABLE',
    speechInstruction:
      '[say calmly with a friendly, reassuring tone and relaxed pacing]',
    sortOrder: 20,
  },
  {
    identifier: 'star',
    names: { en: 'Star', fr: 'Etoile', pt: 'Estrela', it: 'Stella' },
    voice: 'Luna',
    model: DEFAULT_INWORLD_TTS_MODEL,
    deliveryMode: 'BALANCED',
    speechInstruction:
      '[say wonderingly with a soft, magical tone and clear pacing]',
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
    voice: 'Alex',
    model: DEFAULT_INWORLD_TTS_MODEL,
    deliveryMode: 'CREATIVE',
    speechInstruction: '[say excitedly with an energetic tone and lively pace]',
    sortOrder: 40,
  },
  {
    identifier: 'thunder',
    names: { en: 'Thunder', fr: 'Tonnerre', pt: 'Trovao', it: 'Tuono' },
    voice: 'Blake',
    model: DEFAULT_INWORLD_TTS_MODEL,
    deliveryMode: 'BALANCED',
    speechInstruction:
      '[say boldly with a low, adventurous tone and steady pacing]',
    sortOrder: 50,
  },
  {
    identifier: 'noble',
    names: { en: 'Noble', fr: 'Noble', pt: 'Nobre', it: 'Nobile' },
    voice: 'Sarah',
    model: DEFAULT_INWORLD_TTS_MODEL,
    deliveryMode: 'STABLE',
    speechInstruction:
      '[say gracefully with a warm, elegant tone and measured pace]',
    sortOrder: 60,
  },
] as const satisfies readonly StorytellerCatalogEntry[];

export type StorytellerIdentifier =
  (typeof STORYTELLER_CATALOG)[number]['identifier'];

export function isLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getStorytellerByIdentifier(
  identifier: string | null | undefined,
): (typeof STORYTELLER_CATALOG)[number] {
  return (
    STORYTELLER_CATALOG.find((item) => item.identifier === identifier) ??
    STORYTELLER_CATALOG[0]
  );
}
