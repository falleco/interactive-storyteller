import { CACHE_MANAGER, type Cache } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Storyteller } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Language } from './storyteller-catalog';

// Storytellers are seed-driven and rarely change at runtime. A long TTL is
// fine; the per-language key keeps invalidation simple if we ever expose an
// admin endpoint to toggle one off.
const LIST_CACHE_TTL_MS = 60 * 60 * 1_000; // 1h
const LIST_CACHE_KEY = (language: Language) => `storytellers:list:${language}`;

@Injectable()
export class StorytellersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Public list, language-scoped, ordered by sortOrder then name. */
  listByLanguage(language: Language): Promise<Storyteller[]> {
    return this.cache.wrap(
      LIST_CACHE_KEY(language),
      () =>
        this.prisma.storyteller.findMany({
          where: { language, enabled: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
      LIST_CACHE_TTL_MS,
    );
  }

  findByLanguageAndIdentifier(
    language: Language,
    identifier: string,
  ): Promise<Storyteller | null> {
    return this.prisma.storyteller.findUnique({
      where: { language_identifier: { language, identifier } },
    });
  }
}
