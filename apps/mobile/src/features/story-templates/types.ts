import type { Language } from '../storytellers';

export interface StoryTemplate {
  id: string;
  title: string;
  description: string | null;
  theme: string;
  /**
   * If set, the template is intended for this language and the wizard should
   * lock to it on selection. `null` means the template works in any language.
   */
  language: Language | null;
  coverImageUrl: string | null;
  isOwned: boolean;
}

export interface CreateStoryTemplateInput {
  title: string;
  description?: string;
  theme: string;
  language?: Language;
}

export interface UpdateStoryTemplateInput {
  title?: string;
  description?: string;
  theme?: string;
  /** Pass `null` to clear (template usable in any language). */
  language?: Language | null;
  enabled?: boolean;
}
