import {
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_STORYTELLER_IDENTIFIER,
  getStorytellerByIdentifier,
  isLanguage,
  type Language,
  STORYTELLER_CATALOG,
  SUPPORTED_LANGUAGES,
} from '@wondertales/shared/storytellers';

export {
  DEFAULT_INWORLD_TTS_MODEL,
  DEFAULT_STORYTELLER_IDENTIFIER,
  getStorytellerByIdentifier,
  isLanguage,
  type Language,
  STORYTELLER_CATALOG,
  SUPPORTED_LANGUAGES,
};

export interface StaticStoryteller {
  id: string;
  identifier: string;
  language: Language;
  name: string;
  model: string;
  voice: string;
  imageUrl: string;
  previewAudioUrl: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const STATIC_STORYTELLER_TIMESTAMP = new Date('2026-01-01T00:00:00.000Z');

export function listStaticStorytellersByLanguage(
  language: Language,
): StaticStoryteller[] {
  return STORYTELLER_CATALOG.map((storyteller) =>
    toStaticStoryteller(storyteller.identifier, language),
  ).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getStaticStoryteller(
  language: Language,
  identifier: string,
): StaticStoryteller | null {
  const storyteller = STORYTELLER_CATALOG.find(
    (item) => item.identifier === identifier,
  );
  return storyteller
    ? toStaticStoryteller(storyteller.identifier, language)
    : null;
}

export function getStorytellerPortraitUrl(identifier: string): string {
  return `https://placeholder.invalid/storytellers/${identifier}.svg`;
}

export function getStorytellerPreviewAudioUrl(
  language: Language,
  identifier: string,
): string {
  return `https://placeholder.invalid/storytellers/${language}/${identifier}/preview.mp3`;
}

function toStaticStoryteller(
  identifier: string,
  language: Language,
): StaticStoryteller {
  const storyteller = getStorytellerByIdentifier(identifier);
  return {
    id: `${language}-${storyteller.identifier}`,
    identifier: storyteller.identifier,
    language,
    name: storyteller.names[language] ?? storyteller.names.en,
    model: storyteller.model,
    voice: storyteller.voice,
    imageUrl: getStorytellerPortraitUrl(storyteller.identifier),
    previewAudioUrl: getStorytellerPreviewAudioUrl(
      language,
      storyteller.identifier,
    ),
    enabled: true,
    sortOrder: storyteller.sortOrder,
    createdAt: STATIC_STORYTELLER_TIMESTAMP,
    updatedAt: STATIC_STORYTELLER_TIMESTAMP,
  };
}
