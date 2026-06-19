import { Injectable } from '@nestjs/common';
import {
  getStaticStoryteller,
  type Language,
  listStaticStorytellersByLanguage,
  type StaticStoryteller,
} from './storyteller-catalog';

@Injectable()
export class StorytellersService {
  listByLanguage(language: Language): StaticStoryteller[] {
    return listStaticStorytellersByLanguage(language);
  }

  findByLanguageAndIdentifier(
    language: Language,
    identifier: string,
  ): StaticStoryteller | null {
    return getStaticStoryteller(language, identifier);
  }
}
