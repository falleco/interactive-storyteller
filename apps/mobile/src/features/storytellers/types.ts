export type Language = 'pt' | 'en' | 'fr' | 'it';

/** Languages exposed in the mobile UI for now. */
export const ENABLED_LANGUAGES: Language[] = ['pt', 'en'];

export interface Storyteller {
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
  createdAt: string;
  updatedAt: string;
}
