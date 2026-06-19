import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CuratedBook,
  CuratedBookLocalization,
  CuratedBookPage,
  CuratedBookPageLocalization,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  STORY_GAME_NARRATION_CUES,
  type StoryGameDescriptor,
  type StoryGameNarrationCueId,
} from '@wondertales/shared/games';
import type { NarrationAudioTiming } from '@wondertales/shared/stories';
import type { GeneratedCuratedBook } from './ai';
import {
  generateAudioAsset,
  generateImageAsset,
  generateImageAssetWithProgress,
  type ImageReference,
  reviseCuratedPageText,
} from './ai';
import { prisma } from './prisma';
import {
  type BuilderBookLocalization,
  type BuilderBookPayload,
  type BuilderBookSummary,
  type BuilderCharacter,
  type BuilderImageAspect,
  type BuilderLanguage,
  type BuilderNarrationBlock,
  type BuilderPageLocalization,
  type BuilderPagePayload,
  DEFAULT_IMAGE_ASPECT,
  IMAGE_ASPECT_OPTIONS,
  SUPPORTED_LANGUAGES,
} from './types';

type CuratedBookWithRelations = CuratedBook & {
  localizations: CuratedBookLocalization[];
  pages: Array<
    CuratedBookPage & { localizations: CuratedBookPageLocalization[] }
  >;
};

const DEFAULT_PROMPT =
  'Create a warm, age-appropriate storybook concept with a clear emotional arc.';
const CHARACTER_IMAGE_PROMPT_RULES = [
  'NO TEXT',
  'FULL BODY',
  'CHROMA-KEY BG',
] as const;
const PUBLISH_REQUIRED_LANGUAGES = [
  'en',
] as const satisfies readonly BuilderLanguage[];

export type ImageGenerationProgress = {
  index: number;
  imageUrl: string;
};

type ImageGenerationProgressCallback = (
  event: ImageGenerationProgress,
) => Promise<void> | void;

type ImageGenerationStatusCallback = (message: string) => Promise<void> | void;

export async function listBuilderBooks(): Promise<BuilderBookSummary[]> {
  const rows = await prisma.curatedBook.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      status: true,
      builderPhase: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      localizations: true,
      _count: { select: { pages: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    status: normalizeStatus(row.status),
    builderPhase: normalizePhase(row.builderPhase),
    coverImageUrl: row.coverImageUrl ?? '',
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    pageCount: row._count.pages,
    localizations: buildBookLocalizationRecord(row.localizations),
  }));
}

export async function getBuilderBookPayload(
  id: string,
): Promise<BuilderBookPayload | null> {
  const row = await prisma.curatedBook.findUnique({
    where: { id },
    include: {
      localizations: true,
      pages: {
        orderBy: { pageNumber: 'asc' },
        include: { localizations: true },
      },
    },
  });

  return row ? toBuilderBookPayload(row) : null;
}

export async function createBuilderBook(input: {
  prompt?: string;
  title?: string;
}): Promise<BuilderBookPayload> {
  const prompt = input.prompt?.trim() || DEFAULT_PROMPT;
  const title = input.title?.trim() || titleFromBrief(prompt);
  const slug = await ensureUniqueSlug(slugify(title));
  const created = await prisma.curatedBook.create({
    data: {
      slug,
      status: 'draft',
      builderPhase: 'text',
      baseLanguage: 'en',
      storyteller: 'sparkle',
      defaultVoice: 'sparkle',
      imageAspect: DEFAULT_IMAGE_ASPECT,
      prompt,
      localizations: {
        create: SUPPORTED_LANGUAGES.map((language) => ({
          language,
          title,
          summary: '',
        })),
      },
    },
  });

  const payload = await getBuilderBookPayload(created.id);
  if (!payload) throw new Error('Created book could not be reloaded');
  return payload;
}

export async function saveBuilderBook(
  id: string,
  input: BuilderBookPayload,
): Promise<BuilderBookPayload> {
  const currentGenerationMeta = await getCurrentGenerationMeta(id);
  const coverImageUrl = await normalizeStoredImageUrl({
    bookId: id,
    assetId: 'cover',
    imageUrl: input.coverImageUrl,
  });
  const pages = await Promise.all(
    input.pages.map(async (page) => ({
      ...page,
      imageUrl: await normalizeStoredImageUrl({
        bookId: id,
        assetId: `page-${page.pageNumber}`,
        imageUrl: page.imageUrl,
      }),
    })),
  );

  await prisma.$transaction(async (tx) => {
    await tx.curatedBook.update({
      where: { id },
      data: {
        slug: input.slug.trim(),
        status: input.status === 'published' ? 'draft' : input.status,
        builderPhase: input.builderPhase,
        baseLanguage: input.baseLanguage,
        storyteller:
          input.defaultVoice.trim() || input.storyteller.trim() || 'sparkle',
        defaultVoice:
          input.defaultVoice.trim() || input.storyteller.trim() || 'sparkle',
        ageMin: Math.max(0, Math.trunc(input.ageMin)),
        ageMax: Math.max(0, Math.trunc(input.ageMax)),
        prompt: input.prompt.trim() || DEFAULT_PROMPT,
        stylePrompt: emptyToNull(input.stylePrompt),
        imageAspect: normalizeImageAspect(input.imageAspect),
        coverImagePrompt: emptyToNull(input.coverImagePrompt),
        coverImageUrl: emptyToNull(coverImageUrl),
        characters: normalizeCharacters(
          input.characters,
        ) as unknown as Prisma.InputJsonValue,
        generationMeta: withCoverCharacterIds(
          currentGenerationMeta,
          input.coverCharacterIds,
          input.characters,
        ) as Prisma.InputJsonValue,
      },
    });

    for (const language of SUPPORTED_LANGUAGES) {
      const localization = input.localizations[language];
      await tx.curatedBookLocalization.upsert({
        where: { bookId_language: { bookId: id, language } },
        create: {
          bookId: id,
          language,
          title: localization.title.trim() || input.slug,
          summary: localization.summary.trim(),
        },
        update: {
          title: localization.title.trim() || input.slug,
          summary: localization.summary.trim(),
        },
      });
    }

    await tx.curatedBookPage.deleteMany({ where: { bookId: id } });

    for (const [index, page] of pages.entries()) {
      await tx.curatedBookPage.create({
        data: {
          ...(isTemporaryBuilderId(page.id) ? {} : { id: page.id }),
          bookId: id,
          pageNumber: index + 1,
          pageType: normalizePageType(page.pageType),
          imageAspect: normalizeImageAspect(page.imageAspect),
          imagePrompt: emptyToNull(page.imagePrompt),
          imageUrl: emptyToNull(page.imageUrl),
          characterIds: normalizeCharacterIds(
            page.characterIds,
            input.characters,
          ) as unknown as Prisma.InputJsonValue,
          game:
            normalizePageType(page.pageType) === 'game' && page.game
              ? (page.game as unknown as Prisma.InputJsonValue)
              : undefined,
          localizations: {
            create: SUPPORTED_LANGUAGES.map((language) => {
              const localization = page.localizations[language];
              const narrationBlocks = normalizeNarrationBlocks({
                blocks: localization.narrationBlocks,
                fallbackText:
                  localization.narrationText.trim() ||
                  localization.content.trim(),
                defaultVoice: input.defaultVoice,
              });
              return {
                language,
                content: localization.content.trim(),
                contentHtml: emptyToNull(
                  localization.contentHtml || textToHtml(localization.content),
                ),
                narrationText:
                  localization.narrationText.trim() ||
                  localization.content.trim(),
                narrationHtml: emptyToNull(
                  localization.narrationHtml ||
                    textToHtml(
                      localization.narrationText || localization.content,
                    ),
                ),
                narrationBlocks:
                  narrationBlocks as unknown as Prisma.InputJsonValue,
                audioUrl: emptyToNull(localization.audioUrl),
              };
            }),
          },
        },
      });
    }
  });

  const payload = await getBuilderBookPayload(id);
  if (!payload) throw new Error('Saved book could not be reloaded');
  return payload;
}

export async function replaceWithGeneratedBook(
  id: string,
  generated: GeneratedCuratedBook,
  options: { updateSlugFromTitle?: boolean } = {},
): Promise<BuilderBookPayload> {
  const existing = await prisma.curatedBook.findUnique({
    where: { id },
    select: { defaultVoice: true, imageAspect: true, storyteller: true },
  });
  const defaultVoice =
    existing?.defaultVoice ?? existing?.storyteller ?? 'sparkle';
  const nextSlug = options.updateSlugFromTitle
    ? await ensureUniqueSlug(slugify(generated.localizations.en.title), id)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.curatedBook.update({
      where: { id },
      data: {
        ...(nextSlug ? { slug: nextSlug } : {}),
        status: 'draft',
        builderPhase: 'text',
        ageMin: generated.ageMin,
        ageMax: generated.ageMax,
        imageAspect: normalizeImageAspect(existing?.imageAspect),
        stylePrompt: generated.stylePrompt,
        coverImagePrompt: generated.coverImagePrompt,
        characters: normalizeCharacters(
          generated.characters,
        ) as unknown as Prisma.InputJsonValue,
        generationMeta: generated.meta as Prisma.InputJsonValue,
      },
    });

    for (const language of SUPPORTED_LANGUAGES) {
      const localization = generated.localizations[language];
      await tx.curatedBookLocalization.upsert({
        where: { bookId_language: { bookId: id, language } },
        create: {
          bookId: id,
          language,
          title: localization.title,
          summary: localization.summary,
        },
        update: {
          title: localization.title,
          summary: localization.summary,
        },
      });
    }

    await tx.curatedBookPage.deleteMany({ where: { bookId: id } });

    for (const [index, page] of generated.pages.entries()) {
      await tx.curatedBookPage.create({
        data: {
          bookId: id,
          pageNumber: index + 1,
          pageType: page.game ? 'game' : 'story',
          imageAspect: DEFAULT_IMAGE_ASPECT,
          imagePrompt: page.imagePrompt,
          imageUrl: null,
          characterIds: normalizeCharacterIds(
            page.characterIds,
            generated.characters,
          ) as unknown as Prisma.InputJsonValue,
          game: page.game
            ? (page.game as unknown as Prisma.InputJsonValue)
            : undefined,
          localizations: {
            create: SUPPORTED_LANGUAGES.map((language) => {
              const localization = page.localizations[language];
              const narrationBlocks = buildDefaultNarrationBlocks(
                localization.narrationText,
                defaultVoice,
              );
              return {
                language,
                content: localization.content,
                contentHtml: textToHtml(localization.content),
                narrationText: localization.narrationText,
                narrationHtml: textToHtml(localization.narrationText),
                narrationBlocks:
                  narrationBlocks as unknown as Prisma.InputJsonValue,
              };
            }),
          },
        },
      });
    }
  });

  const payload = await getBuilderBookPayload(id);
  if (!payload) throw new Error('Generated book could not be reloaded');
  return payload;
}

export async function publishBuilderBook(
  id: string,
): Promise<BuilderBookPayload> {
  const payload = await getBuilderBookPayload(id);
  if (!payload) throw new Error('Book not found');
  if (payload.status === 'archived') {
    throw new Error('Archived stories cannot be published');
  }
  validatePublishable(payload);

  await prisma.curatedBook.update({
    where: { id },
    data: {
      status: 'published',
      builderPhase: 'ready',
      publishedAt: new Date(),
    },
  });

  const published = await getBuilderBookPayload(id);
  if (!published) throw new Error('Published book could not be reloaded');
  return published;
}

export async function archiveBuilderBook(
  id: string,
): Promise<BuilderBookPayload> {
  await prisma.curatedBook.update({
    where: { id },
    data: { status: 'archived' },
  });

  const archived = await getBuilderBookPayload(id);
  if (!archived) throw new Error('Archived book could not be reloaded');
  return archived;
}

export async function deleteArchivedBuilderBook(id: string): Promise<void> {
  const row = await prisma.curatedBook.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!row) throw new Error('Book not found');
  if (row.status !== 'archived') {
    throw new Error('Only archived books can be deleted');
  }
  await prisma.curatedBook.delete({ where: { id } });
  await rm(path.join(getBuilderPublicDir(), 'generated', 'books', id), {
    force: true,
    recursive: true,
  });
}

export async function deleteDraftBuilderBook(id: string): Promise<void> {
  const row = await prisma.curatedBook.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!row) return;
  if (row.status !== 'draft' && row.status !== 'failed') {
    throw new Error('Only draft books can be discarded');
  }
  await prisma.curatedBook.delete({ where: { id } });
  await rm(path.join(getBuilderPublicDir(), 'generated', 'books', id), {
    force: true,
    recursive: true,
  });
}

export async function generateCoverImageForBook(
  id: string,
  options: {
    onProgress?: ImageGenerationProgressCallback;
    onStatus?: ImageGenerationStatusCallback;
  } = {},
): Promise<BuilderBookPayload> {
  const row = await prisma.curatedBook.findUnique({ where: { id } });
  if (!row) throw new Error('Book not found');
  const characters = parseCharacters(row.characters);
  const coverCharacterIds = normalizeCharacterIds(
    getCoverCharacterIds(row.generationMeta),
    row.characters,
  );
  const prompt = row.coverImagePrompt
    ? buildFinalPrompt(
        row.stylePrompt,
        row.coverImagePrompt,
        buildCharactersPrompt(characters, coverCharacterIds),
      )
    : '';
  if (!prompt.trim()) throw new Error('Cover image prompt is required');

  const coverImageUrl = await generateAndSaveImageAsset({
    bookId: id,
    assetId: 'cover',
    aspect: normalizeImageAspect(row.imageAspect),
    prompt,
    references: buildImageReferences(characters, coverCharacterIds),
    onProgress: options.onProgress,
    onStatus: options.onStatus,
  });
  await prisma.curatedBook.update({
    where: { id },
    data: { coverImageUrl },
  });
  await advanceToAudioWhenImagesReady(id);

  const payload = await getBuilderBookPayload(id);
  if (!payload) throw new Error('Cover-generated book could not be reloaded');
  return payload;
}

export async function generatePageImageForBook(input: {
  bookId: string;
  pageId: string;
  onProgress?: ImageGenerationProgressCallback;
  onStatus?: ImageGenerationStatusCallback;
}): Promise<BuilderBookPayload> {
  const page = await prisma.curatedBookPage.findFirst({
    where: { id: input.pageId, bookId: input.bookId },
    include: { book: true },
  });
  if (!page) throw new Error('Page not found');
  if (page.pageType === 'game') {
    throw new Error('Game pages do not use page images');
  }
  const characters = parseCharacters(page.book.characters);
  const characterIds = parseCharacterIds(page.characterIds);
  const prompt = page.imagePrompt
    ? buildFinalPrompt(
        page.book.stylePrompt,
        page.imagePrompt,
        buildCharactersPrompt(characters, characterIds),
      )
    : '';
  if (!prompt.trim()) throw new Error('Page image prompt is required');

  const imageUrl = await generateAndSaveImageAsset({
    bookId: input.bookId,
    assetId: `page-${page.pageNumber}`,
    aspect: normalizeImageAspect(page.imageAspect),
    prompt,
    references: buildImageReferences(characters, characterIds),
    onProgress: input.onProgress,
    onStatus: input.onStatus,
  });
  await prisma.curatedBookPage.update({
    where: { id: input.pageId },
    data: { imageUrl },
  });
  await advanceToAudioWhenImagesReady(input.bookId);

  const payload = await getBuilderBookPayload(input.bookId);
  if (!payload) throw new Error('Page-image-generated book could not reload');
  return payload;
}

export async function generateCharacterImageForBook(input: {
  bookId: string;
  characterId: string;
  onProgress?: ImageGenerationProgressCallback;
}): Promise<BuilderBookPayload> {
  const row = await prisma.curatedBook.findUnique({
    where: { id: input.bookId },
  });
  if (!row) throw new Error('Book not found');

  const characters = parseCharacters(row.characters);
  const character = characters.find((item) => item.id === input.characterId);
  if (!character) throw new Error('Character not found');
  if (!character.name.trim()) throw new Error('Character name is required');

  const imageUrl = await generateAndSaveImageAsset({
    bookId: input.bookId,
    assetId: `character-${character.id}`,
    aspect: normalizeImageAspect(row.imageAspect),
    prompt: buildCharacterImagePrompt(row.stylePrompt, character),
    onProgress: input.onProgress,
  });

  await prisma.curatedBook.update({
    where: { id: input.bookId },
    data: {
      characters: characters.map((item) =>
        item.id === character.id ? { ...item, imageUrl } : item,
      ) as unknown as Prisma.InputJsonValue,
    },
  });

  const payload = await getBuilderBookPayload(input.bookId);
  if (!payload) {
    throw new Error('Character-image-generated book could not reload');
  }
  return payload;
}

export async function generateAudioForBook(
  id: string,
  input: { regenerate?: boolean } = {},
): Promise<BuilderBookPayload> {
  const row = await prisma.curatedBook.findUnique({
    where: { id },
    include: {
      pages: {
        orderBy: { pageNumber: 'asc' },
        include: { localizations: true },
      },
    },
  });
  if (!row) throw new Error('Book not found');

  for (const page of row.pages) {
    for (const localization of page.localizations) {
      const language = normalizeLanguage(localization.language);
      const text =
        localization.narrationText.trim() || localization.content.trim();
      if (!text) continue;
      const blocks = normalizeNarrationBlocks({
        blocks: parseNarrationBlocks(localization.narrationBlocks),
        fallbackText: text,
        defaultVoice: row.defaultVoice,
      });
      let didChange = false;
      for (const block of blocks) {
        if (block.audioUrl && !input.regenerate) continue;
        if (!block.text.trim()) continue;
        const audio = await generateAudioAsset({
          text: block.text,
          language,
          voice: block.voice || row.defaultVoice,
        });
        block.audioUrl = await saveGeneratedAudioAsset({
          bookId: id,
          assetId: `page-${page.pageNumber}-${language}-${block.id}`,
          audio: audio.audio,
        });
        block.audioTiming = audio.timing;
        didChange = true;
      }
      if (!didChange && localization.audioUrl && !input.regenerate) continue;
      await prisma.curatedBookPageLocalization.update({
        where: { id: localization.id },
        data: {
          narrationBlocks: blocks as unknown as Prisma.InputJsonValue,
          audioUrl: blocks.length === 1 ? (blocks[0]?.audioUrl ?? null) : null,
        },
      });
    }

    const game = parseStoredStoryGameDescriptor(page.game);
    if (game) {
      const nextGame = await generateGameNarrationAudio({
        bookId: id,
        pageNumber: page.pageNumber,
        defaultVoice: row.defaultVoice,
        game,
        regenerate: input.regenerate,
      });
      if (nextGame !== game) {
        await prisma.curatedBookPage.update({
          where: { id: page.id },
          data: { game: nextGame as unknown as Prisma.InputJsonValue },
        });
      }
    }
  }

  await advanceToReadyWhenAudioReady(id);

  const payload = await getBuilderBookPayload(id);
  if (!payload) throw new Error('Audio-generated book could not be reloaded');
  return payload;
}

async function generateGameNarrationAudio(input: {
  bookId: string;
  pageNumber: number;
  defaultVoice: string;
  game: StoryGameDescriptor;
  regenerate?: boolean;
}): Promise<StoryGameDescriptor> {
  if (!input.game.narration) return input.game;
  let didChange = false;
  const narration = { ...input.game.narration };

  for (const language of SUPPORTED_LANGUAGES) {
    const languageNarration = narration[language];
    if (!languageNarration) continue;
    const nextLanguageNarration = { ...languageNarration };

    for (const cue of STORY_GAME_NARRATION_CUES) {
      const item = nextLanguageNarration[cue.id];
      const text = item?.text.trim() ?? '';
      if (!text) continue;
      if (item?.audioUrl && !input.regenerate) continue;
      const audio = await generateAudioAsset({
        text,
        language,
        voice: item?.voice || input.defaultVoice,
      });
      nextLanguageNarration[cue.id] = {
        ...item,
        text,
        voice: item?.voice ?? null,
        audioUrl: await saveGeneratedAudioAsset({
          bookId: input.bookId,
          assetId: `page-${input.pageNumber}-game-${language}-${cue.id}`,
          audio: audio.audio,
        }),
        audioObjectKey: null,
        audioTiming: audio.timing,
      };
      didChange = true;
    }

    narration[language] = nextLanguageNarration;
  }

  return didChange ? { ...input.game, narration } : input.game;
}

export async function generateNarrationBlockAudio(input: {
  bookId: string;
  pageId: string;
  language: BuilderLanguage;
  blockId: string;
  regenerate?: boolean;
}): Promise<BuilderBookPayload> {
  const row = await prisma.curatedBookPageLocalization.findFirst({
    where: {
      pageId: input.pageId,
      language: input.language,
      page: { bookId: input.bookId },
    },
    include: { page: { include: { book: true } } },
  });
  if (!row) throw new Error('Narration block not found');

  const blocks = normalizeNarrationBlocks({
    blocks: parseNarrationBlocks(row.narrationBlocks),
    fallbackText: row.narrationText || row.content,
    defaultVoice: row.page.book.defaultVoice,
    legacyAudioUrl: row.audioUrl,
  });
  const block = blocks.find((item) => item.id === input.blockId);
  if (!block) throw new Error('Narration block not found');
  if (!block.text.trim()) throw new Error('Narration block text is required');

  if (!block.audioUrl || input.regenerate) {
    const audio = await generateAudioAsset({
      text: block.text,
      language: input.language,
      voice: block.voice || row.page.book.defaultVoice,
    });
    block.audioUrl = await saveGeneratedAudioAsset({
      bookId: input.bookId,
      assetId: `page-${row.page.pageNumber}-${input.language}-${block.id}`,
      audio: audio.audio,
    });
    block.audioTiming = audio.timing;
  }

  await prisma.curatedBookPageLocalization.update({
    where: { id: row.id },
    data: {
      narrationBlocks: blocks as unknown as Prisma.InputJsonValue,
      audioUrl: blocks.length === 1 ? (blocks[0]?.audioUrl ?? null) : null,
    },
  });
  await advanceToReadyWhenAudioReady(input.bookId);

  const payload = await getBuilderBookPayload(input.bookId);
  if (!payload) throw new Error('Block-audio-generated book could not reload');
  return payload;
}

export async function generateGameNarrationCueAudio(input: {
  bookId: string;
  pageId: string;
  language: BuilderLanguage;
  cueId: StoryGameNarrationCueId;
  regenerate?: boolean;
}): Promise<BuilderBookPayload> {
  const row = await prisma.curatedBookPage.findFirst({
    where: {
      id: input.pageId,
      bookId: input.bookId,
    },
    include: { book: true },
  });
  if (!row) throw new Error('Game page not found');

  const game = parseStoredStoryGameDescriptor(row.game);
  if (!game) throw new Error('Game narration cue not found');

  const narration = { ...(game.narration ?? {}) };
  const languageNarration = { ...(narration[input.language] ?? {}) };
  const cue = languageNarration[input.cueId];
  const text = cue?.text.trim() ?? '';
  if (!text) throw new Error('Game narration cue text is required');

  if (!cue?.audioUrl || input.regenerate) {
    const audio = await generateAudioAsset({
      text,
      language: input.language,
      voice: cue?.voice || row.book.defaultVoice,
    });
    languageNarration[input.cueId] = {
      ...(cue ?? { text }),
      text,
      voice: cue?.voice ?? null,
      audioUrl: await saveGeneratedAudioAsset({
        bookId: input.bookId,
        assetId: `page-${row.pageNumber}-game-${input.language}-${input.cueId}`,
        audio: audio.audio,
      }),
      audioObjectKey: null,
      audioTiming: audio.timing,
    };
    narration[input.language] = languageNarration;

    await prisma.curatedBookPage.update({
      where: { id: row.id },
      data: {
        game: { ...game, narration } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  await advanceToReadyWhenAudioReady(input.bookId);

  const payload = await getBuilderBookPayload(input.bookId);
  if (!payload) {
    throw new Error('Game cue audio generated book could not reload');
  }
  return payload;
}

export async function reviseBuilderPage(input: {
  bookId: string;
  pageId: string;
  instruction: string;
}): Promise<BuilderBookPayload> {
  const book = await getBuilderBookPayload(input.bookId);
  if (!book) throw new Error('Book not found');
  const page = book.pages.find((item) => item.id === input.pageId);
  if (!page) throw new Error('Page not found');
  if (!input.instruction.trim()) {
    throw new Error('Revision instruction is required');
  }

  const revision = await reviseCuratedPageText({
    book,
    page,
    instruction: input.instruction.trim(),
  });

  await prisma.$transaction(async (tx) => {
    await tx.curatedBook.update({
      where: { id: input.bookId },
      data: { builderPhase: 'text' },
    });
    await tx.curatedBookPage.update({
      where: { id: input.pageId },
      data: {
        imagePrompt: revision.imagePrompt,
        imageUrl: null,
        pageType: revision.game ? 'game' : 'story',
        game: revision.game
          ? (revision.game as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
    for (const language of SUPPORTED_LANGUAGES) {
      const localization = revision.localizations[language];
      await tx.curatedBookPageLocalization.upsert({
        where: { pageId_language: { pageId: input.pageId, language } },
        create: {
          pageId: input.pageId,
          language,
          content: localization.content,
          contentHtml: textToHtml(localization.content),
          narrationText: localization.narrationText,
          narrationHtml: textToHtml(localization.narrationText),
          narrationBlocks: buildDefaultNarrationBlocks(
            localization.narrationText,
            book.defaultVoice,
          ) as unknown as Prisma.InputJsonValue,
        },
        update: {
          content: localization.content,
          contentHtml: textToHtml(localization.content),
          narrationText: localization.narrationText,
          narrationHtml: textToHtml(localization.narrationText),
          narrationBlocks: buildDefaultNarrationBlocks(
            localization.narrationText,
            book.defaultVoice,
          ) as unknown as Prisma.InputJsonValue,
          audioUrl: null,
        },
      });
    }
  });

  const payload = await getBuilderBookPayload(input.bookId);
  if (!payload) throw new Error('Revised book could not be reloaded');
  return payload;
}

export function toBuilderBookPayload(
  row: CuratedBookWithRelations,
): BuilderBookPayload {
  return {
    id: row.id,
    slug: row.slug,
    status: normalizeStatus(row.status),
    builderPhase: normalizePhase(row.builderPhase),
    baseLanguage: normalizeLanguage(row.baseLanguage),
    storyteller: row.storyteller,
    defaultVoice: row.defaultVoice ?? row.storyteller,
    ageMin: row.ageMin,
    ageMax: row.ageMax,
    prompt: row.prompt,
    stylePrompt: row.stylePrompt ?? '',
    imageAspect: normalizeImageAspect(row.imageAspect),
    coverImagePrompt: row.coverImagePrompt ?? '',
    coverCharacterIds: normalizeCharacterIds(
      getCoverCharacterIds(row.generationMeta),
      row.characters,
    ),
    coverImageUrl: row.coverImageUrl ?? '',
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    characters: parseCharacters(row.characters),
    localizations: buildBookLocalizationRecord(row.localizations),
    pages: row.pages.map((page) =>
      toBuilderPagePayload(page, row.defaultVoice ?? row.storyteller),
    ),
  };
}

function toBuilderPagePayload(
  page: CuratedBookPage & { localizations: CuratedBookPageLocalization[] },
  defaultVoice: string,
): BuilderPagePayload {
  return {
    id: page.id,
    pageNumber: page.pageNumber,
    pageType: normalizePageType(page.pageType),
    imageAspect: normalizeImageAspect(page.imageAspect),
    imagePrompt: page.imagePrompt ?? '',
    imageUrl: page.imageUrl ?? '',
    characterIds: parseCharacterIds(page.characterIds),
    game:
      page.game && typeof page.game === 'object'
        ? (page.game as BuilderPagePayload['game'])
        : null,
    localizations: buildPageLocalizationRecord(
      page.localizations,
      defaultVoice,
    ),
  };
}

function parseStoredStoryGameDescriptor(
  value: unknown,
): StoryGameDescriptor | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const ageRange = raw.ageRange;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.type !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.prompt !== 'string' ||
    !ageRange ||
    typeof ageRange !== 'object'
  ) {
    return null;
  }
  const age = ageRange as Record<string, unknown>;
  if (typeof age.min !== 'number' || typeof age.max !== 'number') return null;
  return {
    id: raw.id,
    type: raw.type,
    title: raw.title,
    ageRange: { min: age.min, max: age.max },
    prompt: raw.prompt,
    config:
      raw.config && typeof raw.config === 'object'
        ? (raw.config as Record<string, unknown>)
        : {},
    narration:
      raw.narration && typeof raw.narration === 'object'
        ? (raw.narration as StoryGameDescriptor['narration'])
        : undefined,
  };
}

function buildBookLocalizationRecord(
  rows: CuratedBookLocalization[],
): Record<BuilderLanguage, BuilderBookLocalization> {
  return Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => {
      const row = rows.find((item) => item.language === language);
      return [
        language,
        {
          title: row?.title ?? '',
          summary: row?.summary ?? '',
        },
      ];
    }),
  ) as Record<BuilderLanguage, BuilderBookLocalization>;
}

function buildPageLocalizationRecord(
  rows: CuratedBookPageLocalization[],
  defaultVoice: string,
): Record<BuilderLanguage, BuilderPageLocalization> {
  return Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => {
      const row = rows.find((item) => item.language === language);
      return [
        language,
        {
          content: row?.content ?? '',
          contentHtml: row?.contentHtml || textToHtml(row?.content ?? ''),
          narrationText: row?.narrationText ?? '',
          narrationHtml:
            row?.narrationHtml || textToHtml(row?.narrationText ?? ''),
          narrationBlocks: normalizeNarrationBlocks({
            blocks: parseNarrationBlocks(row?.narrationBlocks),
            fallbackText: row?.narrationText || row?.content || '',
            defaultVoice,
            legacyAudioUrl: row?.audioUrl ?? null,
          }),
          audioUrl: row?.audioUrl ?? '',
        },
      ];
    }),
  ) as Record<BuilderLanguage, BuilderPageLocalization>;
}

function parseCharacters(value: unknown): BuilderCharacter[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): BuilderCharacter | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!id || !name) return null;
      return {
        id,
        name,
        imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '',
        role: typeof raw.role === 'string' ? raw.role.trim() : '',
        appearance:
          typeof raw.appearance === 'string' ? raw.appearance.trim() : '',
        details: typeof raw.details === 'string' ? raw.details.trim() : '',
      };
    })
    .filter((item): item is BuilderCharacter => item !== null);
}

function normalizeCharacters(value: unknown): BuilderCharacter[] {
  const seen = new Set<string>();
  return parseCharacters(value)
    .map((character) => ({
      ...character,
      id: slugify(character.id || character.name) || character.id,
    }))
    .filter((character) => {
      if (seen.has(character.id)) return false;
      seen.add(character.id);
      return true;
    });
}

function parseCharacterIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item, index, values): item is string =>
      typeof item === 'string' &&
      item.trim().length > 0 &&
      values.indexOf(item) === index,
  );
}

function normalizeCharacterIds(value: unknown, characters: unknown): string[] {
  const validIds = new Set(parseCharacters(characters).map((item) => item.id));
  return parseCharacterIds(value).filter((id) => validIds.has(id));
}

function isTemporaryBuilderId(id: string): boolean {
  return id.startsWith('new-');
}

async function getCurrentGenerationMeta(bookId: string): Promise<unknown> {
  const row = await prisma.curatedBook.findUnique({
    where: { id: bookId },
    select: { generationMeta: true },
  });
  return row?.generationMeta ?? null;
}

function getCoverCharacterIds(generationMeta: unknown): string[] {
  if (!generationMeta || typeof generationMeta !== 'object') return [];
  return parseCharacterIds(
    (generationMeta as Record<string, unknown>).coverCharacterIds,
  );
}

function withCoverCharacterIds(
  generationMeta: unknown,
  coverCharacterIds: string[],
  characters: unknown,
): Record<string, unknown> {
  const base =
    generationMeta && typeof generationMeta === 'object'
      ? { ...(generationMeta as Record<string, unknown>) }
      : {};
  const normalized = normalizeCharacterIds(coverCharacterIds, characters);
  if (normalized.length > 0) {
    base.coverCharacterIds = normalized;
  } else {
    delete base.coverCharacterIds;
  }
  return base;
}

function buildCharactersPrompt(
  characters: BuilderCharacter[],
  characterIds: string[],
): string {
  const selected = characterIds
    .map((id) => characters.find((character) => character.id === id))
    .filter((item): item is BuilderCharacter => Boolean(item));
  if (selected.length === 0) return '';
  return [
    'Characters present in this illustration:',
    ...selected.map((character) =>
      [
        `- ${character.name}`,
        character.role ? `role/type: ${character.role}` : '',
        character.appearance ? `appearance: ${character.appearance}` : '',
        character.details ? `details: ${character.details}` : '',
      ]
        .filter(Boolean)
        .join('; '),
    ),
  ].join('\n');
}

function buildImageReferences(
  characters: BuilderCharacter[],
  characterIds: string[],
): ImageReference[] {
  return characterIds
    .map((id) => characters.find((character) => character.id === id))
    .filter((character): character is BuilderCharacter =>
      Boolean(character?.imageUrl.trim()),
    )
    .map((character) => ({
      id: character.id,
      label: [
        character.name,
        character.role ? `role/type: ${character.role}` : '',
        character.appearance ? `appearance: ${character.appearance}` : '',
      ]
        .filter(Boolean)
        .join('; '),
      imageUrl: character.imageUrl,
    }));
}

function buildCharacterImagePrompt(
  stylePrompt: string | null | undefined,
  character: BuilderCharacter,
): string {
  const rules = `[${CHARACTER_IMAGE_PROMPT_RULES.map((rule) => JSON.stringify(rule)).join(', ')}]`;
  return [
    rules,
    stylePrompt,
    `Create standalone character art for ${character.name}.`,
    character.role ? `Role or type: ${character.role}.` : '',
    character.appearance ? `Appearance: ${character.appearance}.` : '',
    character.details ? `Continuity details: ${character.details}.` : '',
    'Single character only, full body visible from head to feet, clean silhouette, centered pose, no props unless listed in continuity details.',
    'Use a flat chroma-key background suitable for later cutout/removal. No text, no typography, no labels, no title.',
    'High-quality children storybook character design, consistent with the book style.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parseNarrationBlocks(value: unknown): BuilderNarrationBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): BuilderNarrationBlock | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const text = typeof raw.text === 'string' ? raw.text : '';
      if (!text.trim()) return null;
      return {
        id:
          typeof raw.id === 'string' && raw.id ? raw.id : `block-${index + 1}`,
        kind: parseNarrationBlockKind(raw.kind),
        text,
        voice: typeof raw.voice === 'string' && raw.voice ? raw.voice : null,
        speaker:
          typeof raw.speaker === 'string' && raw.speaker ? raw.speaker : null,
        audioUrl:
          typeof raw.audioUrl === 'string' && raw.audioUrl
            ? raw.audioUrl
            : null,
        audioObjectKey:
          typeof raw.audioObjectKey === 'string' && raw.audioObjectKey
            ? raw.audioObjectKey
            : null,
        audioTiming: parseNarrationAudioTiming(raw.audioTiming),
      } satisfies BuilderNarrationBlock;
    })
    .filter((item): item is BuilderNarrationBlock => item !== null);
}

function normalizeNarrationBlocks(input: {
  blocks?: BuilderNarrationBlock[];
  fallbackText: string;
  defaultVoice: string;
  legacyAudioUrl?: string | null;
}): BuilderNarrationBlock[] {
  const blocks = input.blocks?.length
    ? input.blocks
    : buildDefaultNarrationBlocks(input.fallbackText, input.defaultVoice);
  const normalized = blocks
    .map((block, index) => ({
      id: block.id?.trim() || `block-${index + 1}`,
      kind: parseNarrationBlockKind(block.kind),
      text: block.text.trim(),
      voice:
        block.voice && block.voice !== input.defaultVoice
          ? block.voice.trim()
          : null,
      speaker: block.speaker?.trim() || null,
      audioUrl: block.audioUrl?.trim() || null,
      audioObjectKey: block.audioObjectKey?.trim() || null,
      audioTiming: block.audioUrl
        ? parseNarrationAudioTiming(block.audioTiming)
        : null,
    }))
    .filter((block) => block.text.length > 0);

  if (
    normalized.length === 1 &&
    input.legacyAudioUrl &&
    !normalized[0]?.audioUrl
  ) {
    normalized[0].audioUrl = input.legacyAudioUrl;
  }

  return normalized.length
    ? normalized
    : buildDefaultNarrationBlocks(input.fallbackText, input.defaultVoice);
}

function buildDefaultNarrationBlocks(
  text: string,
  _defaultVoice: string,
): BuilderNarrationBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return [
    {
      id: 'block-1',
      kind: 'narration',
      text: trimmed,
      voice: null,
      speaker: null,
      audioUrl: null,
      audioObjectKey: null,
      audioTiming: null,
    },
  ];
}

function parseNarrationAudioTiming(
  value: unknown,
): NarrationAudioTiming | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const words = parseNarrationWordTimings(raw.words);
  if (raw.provider !== 'inworld' || words.length === 0) return null;
  return {
    provider: 'inworld',
    model: typeof raw.model === 'string' ? raw.model : '',
    voice: typeof raw.voice === 'string' ? raw.voice : '',
    language: typeof raw.language === 'string' ? raw.language : '',
    words,
    phrases: parseNarrationPhraseTimings(raw.phrases),
    duration: typeof raw.duration === 'number' ? raw.duration : null,
  };
}

function parseNarrationWordTimings(
  value: unknown,
): NarrationAudioTiming['words'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): NarrationAudioTiming['words'][number] | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (
        typeof raw.word !== 'string' ||
        typeof raw.startTime !== 'number' ||
        typeof raw.endTime !== 'number'
      ) {
        return null;
      }
      return {
        word: raw.word,
        startTime: raw.startTime,
        endTime: raw.endTime,
      };
    })
    .filter(
      (item): item is NarrationAudioTiming['words'][number] => item !== null,
    );
}

function parseNarrationPhraseTimings(
  value: unknown,
): NarrationAudioTiming['phrases'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): NarrationAudioTiming['phrases'][number] | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      if (
        typeof raw.text !== 'string' ||
        typeof raw.startTime !== 'number' ||
        typeof raw.endTime !== 'number' ||
        typeof raw.wordStartIndex !== 'number' ||
        typeof raw.wordEndIndex !== 'number'
      ) {
        return null;
      }
      return {
        text: raw.text,
        startTime: raw.startTime,
        endTime: raw.endTime,
        wordStartIndex: raw.wordStartIndex,
        wordEndIndex: raw.wordEndIndex,
      };
    })
    .filter(
      (item): item is NarrationAudioTiming['phrases'][number] => item !== null,
    );
}

function parseNarrationBlockKind(
  value: unknown,
): BuilderNarrationBlock['kind'] {
  return value === 'dialogue' || value === 'aside' ? value : 'narration';
}

function validatePublishable(book: BuilderBookPayload): void {
  const english = book.localizations.en;
  if (!english.title.trim()) throw new Error('English title is required');
  if (book.pages.length === 0) throw new Error('At least one page is required');

  for (const page of book.pages) {
    if (page.pageType === 'game') {
      if (!page.game) {
        throw new Error(`Page ${page.pageNumber} is missing a game`);
      }
      for (const language of PUBLISH_REQUIRED_LANGUAGES) {
        for (const cue of STORY_GAME_NARRATION_CUES) {
          const item = page.game.narration?.[language]?.[cue.id];
          const text = item?.text.trim() ?? '';
          if (!text) {
            throw new Error(
              `Page ${page.pageNumber} game is missing ${language} ${cue.label}`,
            );
          }
          if (!item?.audioUrl) {
            throw new Error(
              `Page ${page.pageNumber} game is missing ${language} ${cue.label} audio`,
            );
          }
        }
      }
      continue;
    }
    const localization = page.localizations.en;
    if (!localization.content.trim()) {
      throw new Error(`Page ${page.pageNumber} is missing English content`);
    }
    if (!page.imageUrl.trim()) {
      throw new Error(`Page ${page.pageNumber} image is missing`);
    }
    for (const language of PUBLISH_REQUIRED_LANGUAGES) {
      const localizedPage = page.localizations[language];
      const blocks = localizedPage.narrationBlocks.length
        ? localizedPage.narrationBlocks
        : buildDefaultNarrationBlocks(
            localizedPage.narrationText || localizedPage.content,
            book.defaultVoice,
          );
      const narratedBlocks = blocks.filter((block) => block.text.trim());
      if (narratedBlocks.length === 0) {
        throw new Error(
          `Page ${page.pageNumber} ${language} narration is missing`,
        );
      }
      if (narratedBlocks.some((block) => !block.audioUrl?.trim())) {
        throw new Error(
          `Page ${page.pageNumber} ${language} narration audio is missing`,
        );
      }
    }
  }
}

async function advanceToAudioWhenImagesReady(bookId: string): Promise<void> {
  const book = await prisma.curatedBook.findUnique({
    where: { id: bookId },
    include: { pages: true },
  });
  if (!book || book.builderPhase === 'audio' || book.builderPhase === 'ready') {
    return;
  }
  const coverReady = book.coverImagePrompt ? Boolean(book.coverImageUrl) : true;
  const pagesReady = book.pages.every((page) =>
    page.pageType === 'game'
      ? true
      : page.imagePrompt
        ? Boolean(page.imageUrl)
        : true,
  );
  if (!coverReady || !pagesReady) return;
  await prisma.curatedBook.update({
    where: { id: bookId },
    data: { builderPhase: 'audio' },
  });
}

async function advanceToReadyWhenAudioReady(bookId: string): Promise<void> {
  const book = await prisma.curatedBook.findUnique({
    where: { id: bookId },
    include: {
      pages: {
        include: { localizations: true },
      },
    },
  });
  if (!book || book.builderPhase === 'ready') return;
  const allReady = book.pages.every(
    (page) =>
      page.localizations.every((localization) => {
        const blocks = normalizeNarrationBlocks({
          blocks: parseNarrationBlocks(localization.narrationBlocks),
          fallbackText: localization.narrationText || localization.content,
          defaultVoice: book.defaultVoice,
          legacyAudioUrl: localization.audioUrl,
        });
        return blocks.every(
          (block) => !block.text.trim() || Boolean(block.audioUrl),
        );
      }) &&
      isGameNarrationAudioReady(parseStoredStoryGameDescriptor(page.game)),
  );
  if (!allReady) return;
  await prisma.curatedBook.update({
    where: { id: bookId },
    data: { builderPhase: 'ready' },
  });
}

function isGameNarrationAudioReady(game: StoryGameDescriptor | null): boolean {
  if (!game) return true;
  return SUPPORTED_LANGUAGES.every((language) =>
    STORY_GAME_NARRATION_CUES.every((cue) => {
      const text = game.narration?.[language]?.[cue.id]?.text.trim() ?? '';
      return Boolean(text && game.narration?.[language]?.[cue.id]?.audioUrl);
    }),
  );
}

function normalizeLanguage(value: string): BuilderLanguage {
  return SUPPORTED_LANGUAGES.includes(value as BuilderLanguage)
    ? (value as BuilderLanguage)
    : 'en';
}

function normalizeStatus(value: string): BuilderBookPayload['status'] {
  if (
    value === 'draft' ||
    value === 'generating' ||
    value === 'published' ||
    value === 'archived' ||
    value === 'failed'
  ) {
    return value;
  }
  return 'draft';
}

function normalizePhase(value: string): BuilderBookPayload['builderPhase'] {
  if (
    value === 'text' ||
    value === 'images' ||
    value === 'audio' ||
    value === 'ready'
  ) {
    return value;
  }
  return 'text';
}

function normalizePageType(value: string): BuilderPagePayload['pageType'] {
  return value === 'game' ? 'game' : 'story';
}

function normalizeImageAspect(value: unknown): BuilderImageAspect {
  return IMAGE_ASPECT_OPTIONS.some((option) => option.id === value)
    ? (value as BuilderImageAspect)
    : DEFAULT_IMAGE_ASPECT;
}

async function saveGeneratedImageAsset(input: {
  bookId: string;
  assetId: string;
  image: string;
}): Promise<string> {
  if (input.image.startsWith('/generated/')) return input.image;
  const { bytes, extension } = await readImageAsset(input.image);
  const safeAssetId = slugify(input.assetId) || 'image';
  const fileName = `${safeAssetId}-${Date.now()}.${extension}`;
  const relativeDir = path.join('generated', 'books', input.bookId);
  const publicDir = path.join(getBuilderPublicDir(), relativeDir);
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, fileName), bytes);
  return publicAssetUrl(
    `/${relativeDir.split(path.sep).join('/')}/${fileName}`,
  );
}

async function generateAndSaveImageAsset(input: {
  bookId: string;
  assetId: string;
  aspect: BuilderImageAspect;
  prompt: string;
  references?: ImageReference[];
  onProgress?: ImageGenerationProgressCallback;
  onStatus?: ImageGenerationStatusCallback;
}): Promise<string> {
  if (!input.onProgress) {
    return saveGeneratedImageAsset({
      bookId: input.bookId,
      assetId: input.assetId,
      image: await generateImageAsset({
        prompt: input.prompt,
        aspect: input.aspect,
        references: input.references,
        onStatus: input.onStatus,
      }),
    });
  }

  const image = await generateImageAssetWithProgress({
    prompt: input.prompt,
    aspect: input.aspect,
    references: input.references,
    onStatus: input.onStatus,
    onPartialImage: async (event) => {
      const imageUrl = await saveGeneratedImageAsset({
        bookId: input.bookId,
        assetId: `${input.assetId}-partial-${event.index + 1}`,
        image: event.image,
      });
      await input.onProgress?.({ index: event.index, imageUrl });
    },
  });

  return saveGeneratedImageAsset({
    bookId: input.bookId,
    assetId: input.assetId,
    image,
  });
}

async function normalizeStoredImageUrl(input: {
  bookId: string;
  assetId: string;
  imageUrl: string;
}): Promise<string> {
  const imageUrl = input.imageUrl.trim();
  if (!imageUrl.startsWith('data:')) return imageUrl;
  return saveGeneratedImageAsset({
    bookId: input.bookId,
    assetId: input.assetId,
    image: imageUrl,
  });
}

async function saveGeneratedAudioAsset(input: {
  bookId: string;
  assetId: string;
  audio: string;
}): Promise<string> {
  if (input.audio.startsWith('/generated/')) return input.audio;
  const { bytes, extension } = await readAudioAsset(input.audio);
  const safeAssetId = slugify(input.assetId) || 'audio';
  const fileName = `${safeAssetId}-${Date.now()}.${extension}`;
  const relativeDir = path.join('generated', 'books', input.bookId);
  const publicDir = path.join(getBuilderPublicDir(), relativeDir);
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, fileName), bytes);
  return publicAssetUrl(
    `/${relativeDir.split(path.sep).join('/')}/${fileName}`,
  );
}

async function readImageAsset(image: string): Promise<{
  bytes: Buffer;
  extension: string;
}> {
  const dataMatch = image.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    return {
      bytes: Buffer.from(dataMatch[2] ?? '', 'base64'),
      extension: imageExtensionForMime(dataMatch[1] ?? 'image/jpeg'),
    };
  }

  if (/^https?:\/\//i.test(image)) {
    const response = await fetch(image);
    if (!response.ok) {
      throw new Error(
        `Could not download generated image (${response.status})`,
      );
    }
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      extension: imageExtensionForMime(contentType),
    };
  }

  throw new Error('Image generator returned an unsupported image payload');
}

async function readAudioAsset(audio: string): Promise<{
  bytes: Buffer;
  extension: string;
}> {
  const dataMatch = audio.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    return {
      bytes: Buffer.from(dataMatch[2] ?? '', 'base64'),
      extension: audioExtensionForMime(dataMatch[1] ?? 'audio/mpeg'),
    };
  }

  if (/^https?:\/\//i.test(audio)) {
    const response = await fetch(audio);
    if (!response.ok) {
      throw new Error(
        `Could not download generated audio (${response.status})`,
      );
    }
    const contentType = response.headers.get('content-type') ?? 'audio/mpeg';
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      extension: audioExtensionForMime(contentType),
    };
  }

  throw new Error('Audio generator returned an unsupported audio payload');
}

function imageExtensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function audioExtensionForMime(mime: string): string {
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  return 'mp3';
}

function getBuilderPublicDir(): string {
  return process.cwd().endsWith(path.join('apps', 'builder'))
    ? path.join(process.cwd(), 'public')
    : path.join(process.cwd(), 'apps', 'builder', 'public');
}

function publicAssetUrl(pathname: string): string {
  const baseUrl =
    process.env.BUILDER_ASSET_BASE_URL ??
    process.env.NEXT_PUBLIC_BUILDER_URL ??
    'http://localhost:4001';
  return `${baseUrl.replace(/\/$/, '')}${pathname}`;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function titleFromBrief(brief: string): string {
  const normalized = brief.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Untitled story';
  return normalized.slice(0, 64);
}

function textToHtml(value: string): string {
  const escaped = value
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    ? escaped
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '';
}

function buildFinalPrompt(
  stylePrompt: string | null | undefined,
  prompt: string,
  extraContext?: string,
) {
  return [
    stylePrompt,
    prompt,
    extraContext,
    'High-quality children storybook illustration, consistent character design, soft readable composition.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function ensureUniqueSlug(
  baseSlug: string,
  existingBookId?: string,
): Promise<string> {
  const base = baseSlug || 'story';
  let slug = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.curatedBook.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === existingBookId) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
