import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { InworldTTS } from '@inworld/tts';
import {
  findAvailableGame,
  getStoryEnabledGames,
  STORY_GAME_NARRATION_CUES,
  type StoryGameDescriptor,
  toStoryGameDescriptor,
} from '@wondertales/shared/games';
import type {
  NarrationAudioTiming,
  NarrationPhraseTiming,
  NarrationWordTiming,
} from '@wondertales/shared/stories';
import {
  DEFAULT_INWORLD_AUDIO_ENCODING,
  DEFAULT_INWORLD_SAMPLE_RATE,
  getStorytellerByIdentifier,
  INWORLD_LANGUAGE_TAGS,
} from '@wondertales/shared/storytellers';
import OpenAI, { toFile } from 'openai';
import { z } from 'zod';
import {
  type BuilderBookPayload,
  type BuilderImageAspect,
  type BuilderLanguage,
  type BuilderPagePayload,
  DEFAULT_IMAGE_ASPECT,
  IMAGE_ASPECT_OPTIONS,
  SUPPORTED_LANGUAGES,
} from './types';

const DEFAULT_TEXT_MODEL = 'gpt-5.5';
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_OPENAI_IMAGE_QUALITY = 'high';
const DEFAULT_OPENAI_IMAGE_FORMAT = 'jpeg';
const IMPLICIT_IMAGE_PROMPT_RULES = ['NO TEXTS', 'NO TITLES'] as const;

export type ImageReference = {
  id: string;
  label: string;
  imageUrl: string;
};

export type GenerateImageInput = {
  prompt: string;
  aspect?: BuilderImageAspect;
  references?: ImageReference[];
  onStatus?: (message: string) => Promise<void> | void;
};

export type GeneratedAudioAsset = {
  audio: string;
  timing: NarrationAudioTiming | null;
};

type InworldTimestampInfo = {
  wordAlignment?: {
    words?: unknown;
    wordStartTimeSeconds?: unknown;
    wordEndTimeSeconds?: unknown;
  };
};

type TextWordSpan = {
  index: number;
  word: string;
  normalized: string;
  start: number;
  end: number;
};

type AlignedWordTiming = {
  timingIndex: number;
  word: NarrationWordTiming;
  span: TextWordSpan;
};

const bookLocalizationSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
});

const pageLocalizationSchema = z.object({
  content: z.string().min(1),
  narrationText: z.string().min(1),
});

const localizationRecordSchema = z.object({
  en: bookLocalizationSchema,
  fr: bookLocalizationSchema,
  pt: bookLocalizationSchema,
  it: bookLocalizationSchema,
});

const pageLocalizationRecordSchema = z.object({
  en: pageLocalizationSchema,
  fr: pageLocalizationSchema,
  pt: pageLocalizationSchema,
  it: pageLocalizationSchema,
});

const rawGameSchema = z
  .object({
    id: z.string(),
    prompt: z.string(),
    configJson: z.string(),
    narrationJson: z.string(),
  })
  .nullable();

const generatedCharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string(),
  role: z.string(),
  appearance: z.string(),
  details: z.string(),
});

const rawGeneratedBookSchema = z.object({
  ageMin: z.number().int().min(0),
  ageMax: z.number().int().min(0),
  stylePrompt: z.string(),
  coverImagePrompt: z.string(),
  characters: z.array(generatedCharacterSchema),
  localizations: localizationRecordSchema,
  pages: z.array(
    z.object({
      imagePrompt: z.string(),
      characterIds: z.array(z.string()),
      game: rawGameSchema,
      localizations: pageLocalizationRecordSchema,
    }),
  ),
});

export type GeneratedCuratedBook = Omit<
  z.infer<typeof rawGeneratedBookSchema>,
  'pages'
> & {
  pages: GeneratedCuratedPage[];
  meta: {
    provider: 'openai';
    model: string;
    generatedAt: string;
  };
};

export type GeneratedCuratedPage = Omit<
  z.infer<typeof rawGeneratedBookSchema>['pages'][number],
  'game'
> & {
  game: StoryGameDescriptor | null;
};

let openaiClient: OpenAI | null = null;
let inworldTtsClient: ReturnType<typeof InworldTTS> | null = null;

export async function generateCuratedBook(
  book: BuilderBookPayload,
): Promise<GeneratedCuratedBook> {
  const model = process.env.BUILDER_OPENAI_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;
  const response = await getOpenAiClient().responses.create({
    model,
    reasoning: { effort: 'low' },
    instructions: buildGenerationInstructions(),
    input: JSON.stringify({
      brief: book.prompt,
      stylePrompt: book.stylePrompt,
      currentTitle: book.localizations.en.title,
      ageRange: { min: book.ageMin, max: book.ageMax },
      supportedLanguages: SUPPORTED_LANGUAGES,
      availableGames: getStoryEnabledGames(),
    }),
    text: {
      format: {
        type: 'json_schema',
        name: 'wonder_tales_curated_book',
        strict: true,
        schema: generatedBookJsonSchema,
      },
    },
  } as Parameters<OpenAI['responses']['create']>[0]);

  const outputText = (response as { output_text?: string }).output_text;
  if (!outputText) {
    throw new Error('OpenAI returned an empty generation response');
  }

  const parsed = rawGeneratedBookSchema.parse(JSON.parse(outputText));
  return {
    ...parsed,
    pages: parsed.pages.map(parseGeneratedPage),
    meta: {
      provider: 'openai',
      model,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function reviseCuratedPageText(input: {
  book: BuilderBookPayload;
  page: BuilderPagePayload;
  instruction: string;
}): Promise<GeneratedCuratedPage> {
  const model = process.env.BUILDER_OPENAI_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;
  const response = await getOpenAiClient().responses.create({
    model,
    reasoning: { effort: 'low' },
    instructions: buildRevisionInstructions(),
    input: JSON.stringify({
      instruction: input.instruction,
      book: {
        brief: input.book.prompt,
        stylePrompt: input.book.stylePrompt,
        title: input.book.localizations.en.title,
        summary: input.book.localizations.en.summary,
        ageRange: { min: input.book.ageMin, max: input.book.ageMax },
      },
      page: input.page,
      supportedLanguages: SUPPORTED_LANGUAGES,
      availableGames: getStoryEnabledGames(),
    }),
    text: {
      format: {
        type: 'json_schema',
        name: 'wonder_tales_curated_page_revision',
        strict: true,
        schema: generatedPageJsonSchema,
      },
    },
  } as Parameters<OpenAI['responses']['create']>[0]);

  const outputText = (response as { output_text?: string }).output_text;
  if (!outputText) {
    throw new Error('OpenAI returned an empty page revision response');
  }

  return parseGeneratedPage(
    rawGeneratedBookSchema.shape.pages.element.parse(JSON.parse(outputText)),
  );
}

export async function generateImageAsset(
  input: string | GenerateImageInput,
): Promise<string> {
  const normalized = normalizeImageInput(input);
  const outputFormat = normalizeImageOutputFormat(
    process.env.BUILDER_OPENAI_IMAGE_FORMAT,
  );
  const imageSize = imageSizeForAspect(normalized.aspect);
  const referenceFiles = await loadImageReferenceFiles(
    normalized.references,
    normalized.onStatus,
  );
  if (referenceFiles.length > 0) {
    const response = await getOpenAiClient().images.edit({
      model:
        process.env.BUILDER_OPENAI_IMAGE_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL,
      image: referenceFiles,
      prompt: buildReferenceAwareImagePrompt(normalized),
      n: 1,
      size: imageSize,
      quality:
        process.env.BUILDER_OPENAI_IMAGE_QUALITY ??
        DEFAULT_OPENAI_IMAGE_QUALITY,
      output_format: outputFormat,
      background: 'opaque',
      ...(outputFormat === 'jpeg' || outputFormat === 'webp'
        ? { output_compression: 92 }
        : {}),
    } as Parameters<OpenAI['images']['edit']>[0]);
    return extractGeneratedImage(response, outputFormat);
  }

  const response = await getOpenAiClient().images.generate({
    model: process.env.BUILDER_OPENAI_IMAGE_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL,
    prompt: applyImplicitImagePromptRules(normalized.prompt),
    n: 1,
    size: imageSize,
    quality:
      process.env.BUILDER_OPENAI_IMAGE_QUALITY ?? DEFAULT_OPENAI_IMAGE_QUALITY,
    output_format: outputFormat,
    background: 'opaque',
    ...(outputFormat === 'jpeg' || outputFormat === 'webp'
      ? { output_compression: 92 }
      : {}),
  } as Parameters<OpenAI['images']['generate']>[0]);
  return extractGeneratedImage(response, outputFormat);
}

type ImageProgressEvent = {
  index: number;
  image: string;
};

type OpenAiImageStreamEvent = {
  type?: string;
  b64_json?: string;
  output_format?: 'png' | 'jpeg' | 'webp';
  partial_image_index?: number;
};

type ReadImageStreamOptions = {
  outputFormat: 'png' | 'jpeg' | 'webp';
  partialType: string;
  completedType: string;
  onPartialImage?: (event: ImageProgressEvent) => Promise<void> | void;
};

export async function generateImageAssetWithProgress(input: {
  prompt: string;
  aspect?: BuilderImageAspect;
  references?: ImageReference[];
  onStatus?: (message: string) => Promise<void> | void;
  onPartialImage?: (event: ImageProgressEvent) => Promise<void> | void;
}): Promise<string> {
  const outputFormat = normalizeImageOutputFormat(
    process.env.BUILDER_OPENAI_IMAGE_FORMAT,
  );
  const normalized = normalizeImageInput(input);
  const imageSize = imageSizeForAspect(normalized.aspect);
  const referenceFiles = await loadImageReferenceFiles(
    normalized.references,
    normalized.onStatus,
  );
  if (referenceFiles.length > 0) {
    const stream = await getOpenAiClient().images.edit({
      model:
        process.env.BUILDER_OPENAI_IMAGE_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL,
      image: referenceFiles,
      prompt: buildReferenceAwareImagePrompt(normalized),
      n: 1,
      size: imageSize,
      quality:
        process.env.BUILDER_OPENAI_IMAGE_QUALITY ??
        DEFAULT_OPENAI_IMAGE_QUALITY,
      output_format: outputFormat,
      background: 'opaque',
      stream: true,
      partial_images: normalizePartialImageCount(
        process.env.BUILDER_OPENAI_PARTIAL_IMAGES,
      ),
      ...(outputFormat === 'jpeg' || outputFormat === 'webp'
        ? { output_compression: 92 }
        : {}),
    } as Parameters<OpenAI['images']['edit']>[0]);
    return readImageStream(stream as AsyncIterable<OpenAiImageStreamEvent>, {
      outputFormat,
      partialType: 'image_edit.partial_image',
      completedType: 'image_edit.completed',
      onPartialImage: input.onPartialImage,
    });
  }

  const stream = await getOpenAiClient().images.generate({
    model: process.env.BUILDER_OPENAI_IMAGE_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL,
    prompt: applyImplicitImagePromptRules(normalized.prompt),
    n: 1,
    size: imageSize,
    quality:
      process.env.BUILDER_OPENAI_IMAGE_QUALITY ?? DEFAULT_OPENAI_IMAGE_QUALITY,
    output_format: outputFormat,
    background: 'opaque',
    stream: true,
    partial_images: normalizePartialImageCount(
      process.env.BUILDER_OPENAI_PARTIAL_IMAGES,
    ),
    ...(outputFormat === 'jpeg' || outputFormat === 'webp'
      ? { output_compression: 92 }
      : {}),
  } as Parameters<OpenAI['images']['generate']>[0]);

  return readImageStream(stream as AsyncIterable<OpenAiImageStreamEvent>, {
    outputFormat,
    partialType: 'image_generation.partial_image',
    completedType: 'image_generation.completed',
    onPartialImage: input.onPartialImage,
  });
}

export async function generateAudioAsset(input: {
  text: string;
  language: BuilderLanguage;
  voice?: string;
}): Promise<GeneratedAudioAsset> {
  const storyteller = getStorytellerByIdentifier(input.voice);
  const language = INWORLD_LANGUAGE_TAGS[input.language];
  const text = buildInworldTtsText(input.text, storyteller.speechInstruction);
  const { audio, timestamps } =
    await getInworldTtsClient().generateWithTimestamps({
      text,
      voice: storyteller.voice,
      model: storyteller.model,
      encoding: DEFAULT_INWORLD_AUDIO_ENCODING,
      sampleRate: DEFAULT_INWORLD_SAMPLE_RATE,
      language,
      deliveryMode: storyteller.deliveryMode,
      timestampType: 'WORD',
    });

  return {
    audio: `data:audio/mpeg;base64,${Buffer.from(audio).toString('base64')}`,
    timing: buildNarrationAudioTiming({
      originalText: input.text,
      timestamps,
      model: storyteller.model,
      voice: storyteller.voice,
      language,
    }),
  };
}

function getOpenAiClient(): OpenAI {
  if (openaiClient) return openaiClient;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for story generation');
  }
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function getInworldTtsClient(): ReturnType<typeof InworldTTS> {
  if (inworldTtsClient) return inworldTtsClient;
  if (!process.env.INWORLD_API_KEY) {
    throw new Error('INWORLD_API_KEY is required for Inworld TTS generation');
  }
  inworldTtsClient = InworldTTS({ apiKey: process.env.INWORLD_API_KEY });
  return inworldTtsClient;
}

function buildInworldTtsText(text: string, speechInstruction: string): string {
  const spokenText = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${speechInstruction} ${spokenText}`.trim();
}

function buildNarrationAudioTiming(input: {
  originalText: string;
  timestamps: unknown;
  model: string;
  voice: string;
  language: string;
}): NarrationAudioTiming | null {
  const wordAlignment = (input.timestamps as InworldTimestampInfo | undefined)
    ?.wordAlignment;
  const words = normalizeWordTimings({
    words: wordAlignment?.words,
    starts: wordAlignment?.wordStartTimeSeconds,
    ends: wordAlignment?.wordEndTimeSeconds,
  });
  if (words.length === 0) return null;

  return {
    provider: 'inworld',
    model: input.model,
    voice: input.voice,
    language: input.language,
    words,
    phrases: buildPhraseTimings(input.originalText, words),
    duration: words[words.length - 1]?.endTime ?? null,
  };
}

function normalizeWordTimings(input: {
  words: unknown;
  starts: unknown;
  ends: unknown;
}): NarrationWordTiming[] {
  if (
    !Array.isArray(input.words) ||
    !Array.isArray(input.starts) ||
    !Array.isArray(input.ends)
  ) {
    return [];
  }

  const count = Math.min(
    input.words.length,
    input.starts.length,
    input.ends.length,
  );
  const timings: NarrationWordTiming[] = [];
  for (let index = 0; index < count; index++) {
    const word = input.words[index];
    const start = input.starts[index];
    const end = input.ends[index];
    if (
      typeof word !== 'string' ||
      typeof start !== 'number' ||
      typeof end !== 'number' ||
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      continue;
    }
    const startTime = Math.max(0, start);
    timings.push({
      word,
      startTime,
      endTime: Math.max(startTime, end),
    });
  }
  return timings;
}

function buildPhraseTimings(
  text: string,
  words: NarrationWordTiming[],
): NarrationPhraseTiming[] {
  const alignedWords = alignWordTimingsToText(text, words);
  if (alignedWords.length === 0) return [];

  return extractPhraseSpans(text)
    .map((phrase): NarrationPhraseTiming | null => {
      const phraseWords = alignedWords.filter(
        (item) =>
          item.span.start >= phrase.start && item.span.start < phrase.end,
      );
      if (phraseWords.length === 0) return null;
      const first = phraseWords[0];
      const last = phraseWords[phraseWords.length - 1];
      return {
        text: phrase.text,
        startTime: first.word.startTime,
        endTime: last.word.endTime,
        wordStartIndex: first.timingIndex,
        wordEndIndex: last.timingIndex,
      };
    })
    .filter((phrase): phrase is NarrationPhraseTiming => phrase !== null);
}

function alignWordTimingsToText(
  text: string,
  words: NarrationWordTiming[],
): AlignedWordTiming[] {
  const textWords = extractTextWordSpans(text);
  if (textWords.length === 0) return [];

  const aligned: AlignedWordTiming[] = [];
  let searchFrom = 0;
  for (const [timingIndex, word] of words.entries()) {
    const normalized = normalizeAlignmentWord(word.word);
    if (!normalized) continue;
    const spanIndex = textWords.findIndex(
      (span, index) => index >= searchFrom && span.normalized === normalized,
    );
    if (spanIndex === -1) continue;
    aligned.push({ timingIndex, word, span: textWords[spanIndex] });
    searchFrom = spanIndex + 1;
  }
  return aligned;
}

function extractTextWordSpans(text: string): TextWordSpan[] {
  return [...text.matchAll(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g)].map(
    (match, index) => ({
      index,
      word: match[0],
      normalized: normalizeAlignmentWord(match[0]),
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    }),
  );
}

function extractPhraseSpans(text: string): Array<{
  text: string;
  start: number;
  end: number;
}> {
  const matches = [...text.matchAll(/[^.!?]+[.!?]+|[^.!?]+$/g)];
  return matches
    .map((match) => {
      const raw = match[0];
      const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
      const trailingWhitespace = raw.match(/\s*$/)?.[0].length ?? 0;
      const start = (match.index ?? 0) + leadingWhitespace;
      const end = (match.index ?? 0) + raw.length - trailingWhitespace;
      return { text: text.slice(start, end), start, end };
    })
    .filter((phrase) => phrase.text.length > 0);
}

function normalizeAlignmentWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeGeneratedGame(
  raw: z.infer<typeof rawGameSchema>,
): StoryGameDescriptor | null {
  if (!raw) return null;
  const available = findAvailableGame(raw.id);
  if (!available?.storyEnabled) return null;
  const descriptor = toStoryGameDescriptor(available, raw.prompt);
  return {
    ...descriptor,
    config: {
      ...descriptor.config,
      ...parseGameConfigJson(raw.configJson, raw.id),
    },
    narration: parseGameNarrationJson(raw.narrationJson, raw.id),
  };
}

function parseGeneratedPage(
  page: z.infer<typeof rawGeneratedBookSchema>['pages'][number],
): GeneratedCuratedPage {
  return {
    ...page,
    game: normalizeGeneratedGame(page.game),
  };
}

function parseGameConfigJson(
  configJson: string,
  gameId: string,
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(configJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('configJson must decode to an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `OpenAI returned invalid configJson for game "${gameId}": ${
        error instanceof Error ? error.message : 'invalid JSON'
      }`,
    );
  }
}

function parseGameNarrationJson(
  narrationJson: string,
  gameId: string,
): NonNullable<StoryGameDescriptor['narration']> {
  try {
    const parsed = JSON.parse(narrationJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('narrationJson must decode to an object');
    }
    const raw = parsed as Record<string, unknown>;
    return Object.fromEntries(
      SUPPORTED_LANGUAGES.map((language) => {
        const rawLanguage = raw[language];
        const languageNarration =
          rawLanguage && typeof rawLanguage === 'object'
            ? (rawLanguage as Record<string, unknown>)
            : {};
        return [
          language,
          Object.fromEntries(
            STORY_GAME_NARRATION_CUES.map((cue) => {
              const value = languageNarration[cue.id];
              const text =
                typeof value === 'string'
                  ? value
                  : value && typeof value === 'object'
                    ? String((value as { text?: unknown }).text ?? '')
                    : '';
              return [
                cue.id,
                {
                  text,
                  voice: null,
                  audioUrl: null,
                  audioObjectKey: null,
                  audioTiming: null,
                },
              ];
            }),
          ),
        ];
      }),
    );
  } catch (error) {
    throw new Error(
      `OpenAI returned invalid narrationJson for game "${gameId}": ${
        error instanceof Error ? error.message : 'invalid JSON'
      }`,
    );
  }
}

function buildGenerationInstructions(): string {
  return [
    'You create production-ready curated children storybooks for Wonder Tales.',
    'Write the canonical story in English first, then localize it into French, Portuguese, and Italian.',
    'Keep translations natural, not literal. Keep page counts and page ordering identical in every language.',
    'Return exactly the JSON schema. Do not include markdown.',
    'Stories are always linear storybooks. A page may optionally be a game page by returning a game object, otherwise game must be null.',
    'Place at most one game on one page. Use only one of the provided game ids.',
    'Game configJson must be a valid compact JSON object string with story-specific parameters when useful, such as targetWord, roundId, colorHexes, patternIds, or theme labels.',
    'For a game, narrationJson must be a compact JSON object keyed by language. Each language object must include start, failure, successMove, idle, and complete strings for the child action narration.',
    'Return a compact cast in characters. Use stable kebab-case character ids, empty imageUrl strings unless a known final asset URL exists, and concrete role, clothing, species/object type, appearance, and continuity details.',
    'Each page characterIds array must list only ids from characters that are visibly present on that page.',
    'Image prompts must be in English, visual, concrete, and safe for young children.',
  ].join('\n');
}

function buildRevisionInstructions(): string {
  return [
    'You revise exactly one page of a Wonder Tales curated children storybook.',
    'Preserve the book continuity and page role. Apply the requested change only to this page.',
    'Return the complete revised page object in every supported language. Pages do not have dedicated titles.',
    'Keep translations natural and aligned across languages.',
    'Preserve characterIds unless the instruction adds, removes, or replaces visible characters on this page.',
    'You may update the page game preview only if the instruction asks for it or the current game clearly conflicts with the revised page.',
    'Do not create image or audio assets. Only return text, prompts, and optional game metadata.',
    'Game configJson must be a valid compact JSON object string.',
    'For a game, narrationJson must be a compact JSON object keyed by language with start, failure, successMove, idle, and complete strings.',
  ].join('\n');
}

function normalizeImageOutputFormat(
  value: string | undefined,
): 'png' | 'jpeg' | 'webp' {
  if (value === 'png' || value === 'webp') return value;
  return DEFAULT_OPENAI_IMAGE_FORMAT;
}

function normalizeImageInput(
  input: string | GenerateImageInput,
): GenerateImageInput {
  return typeof input === 'string' ? { prompt: input } : input;
}

function imageSizeForAspect(aspect: BuilderImageAspect | undefined): string {
  return (
    IMAGE_ASPECT_OPTIONS.find(
      (option) => option.id === (aspect ?? DEFAULT_IMAGE_ASPECT),
    )?.size ?? IMAGE_ASPECT_OPTIONS[2].size
  );
}

function applyImplicitImagePromptRules(prompt: string): string {
  const rules = `[${IMPLICIT_IMAGE_PROMPT_RULES.map((rule) => JSON.stringify(rule)).join(', ')}]`;
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.startsWith(rules)) return trimmedPrompt;
  return [rules, trimmedPrompt].filter(Boolean).join('\n\n');
}

function buildReferenceAwareImagePrompt(input: GenerateImageInput): string {
  const references = input.references?.filter((reference) =>
    reference.imageUrl.trim(),
  );
  return applyImplicitImagePromptRules(
    [
      'Use the provided reference images only to preserve character identity, clothing, colors, proportions, and visual continuity.',
      'Create a new storybook illustration for this scene.',
      'Do not copy the reference backgrounds unless the prompt explicitly asks for them.',
      'Keep every referenced character consistent with the references while matching the book illustration style.',
      references?.length
        ? [
            'Reference characters:',
            ...references.map(
              (reference, index) => `${index + 1}. ${reference.label}`,
            ),
          ].join('\n')
        : '',
      'Scene:',
      input.prompt,
    ]
      .filter(Boolean)
      .join('\n\n'),
  );
}

async function readImageStream(
  stream: AsyncIterable<OpenAiImageStreamEvent>,
  options: ReadImageStreamOptions,
): Promise<string> {
  let finalImage = '';
  for await (const event of stream) {
    if (!event.b64_json) continue;
    const image = imageDataUrl(
      event.b64_json,
      event.output_format ?? options.outputFormat,
    );
    if (event.type === options.partialType) {
      await options.onPartialImage?.({
        index: event.partial_image_index ?? 0,
        image,
      });
    }
    if (event.type === options.completedType) {
      finalImage = image;
    }
  }

  if (finalImage) return finalImage;
  throw new Error('OpenAI image generation returned no final image');
}

function extractGeneratedImage(
  response: unknown,
  outputFormat: 'png' | 'jpeg' | 'webp',
): string {
  const image = (
    response as { data?: Array<{ url?: string; b64_json?: string }> }
  ).data?.[0];
  if (image?.url) return image.url;
  if (image?.b64_json) {
    return `data:${imageMimeType(outputFormat)};base64,${image.b64_json}`;
  }
  throw new Error('OpenAI image generation returned no image');
}

async function loadImageReferenceFiles(
  references: ImageReference[] | undefined,
  onStatus?: (message: string) => Promise<void> | void,
): Promise<File[]> {
  const files: File[] = [];
  const usableReferences = (references ?? []).filter((reference) =>
    reference.imageUrl.trim(),
  );
  let failedCount = 0;
  for (const reference of usableReferences) {
    try {
      files.push(await loadImageReferenceFile(reference));
    } catch {
      failedCount += 1;
      // Broken references should not block generation; callers fall back to
      // text-only if no reference can be loaded.
    }
    if (files.length >= 16) break;
  }
  if (usableReferences.length > 0 && files.length === 0) {
    await onStatus?.(
      'Reference images could not be loaded; using text-only generation.',
    );
  } else if (failedCount > 0) {
    await onStatus?.(
      `${failedCount} reference image(s) could not be loaded; continuing with ${files.length}.`,
    );
  }
  return files;
}

async function loadImageReferenceFile(
  reference: ImageReference,
): Promise<File> {
  const { bytes, mime } = await readReferenceImage(reference.imageUrl);
  const extension = imageExtensionForMime(mime);
  return toFile(bytes, `${reference.id || 'reference'}.${extension}`, {
    type: mime,
  });
}

async function readReferenceImage(imageUrl: string): Promise<{
  bytes: Buffer;
  mime: string;
}> {
  const trimmed = imageUrl.trim();
  const dataMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    return {
      bytes: Buffer.from(dataMatch[2] ?? '', 'base64'),
      mime: normalizeImageMime(dataMatch[1] ?? 'image/jpeg'),
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(
        `Could not download reference image (${response.status})`,
      );
    }
    const mime = normalizeImageMime(
      response.headers.get('content-type') ?? 'image/jpeg',
    );
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mime,
    };
  }

  if (trimmed.startsWith('/')) {
    const publicPath = trimmed.startsWith('/generated/')
      ? trimmed
      : new URL(trimmed, 'http://builder.local').pathname;
    const filePath = path.join(
      getBuilderPublicDir(),
      publicPath.replace(/^\/+/, ''),
    );
    const bytes = await readFile(filePath);
    return {
      bytes,
      mime: mimeForImagePath(filePath),
    };
  }

  throw new Error('Unsupported reference image URL');
}

function normalizeImageMime(mime: string): string {
  if (mime.includes('png')) return 'image/png';
  if (mime.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

function imageExtensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

function mimeForImagePath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function getBuilderPublicDir(): string {
  return process.cwd().endsWith(path.join('apps', 'builder'))
    ? path.join(process.cwd(), 'public')
    : path.join(process.cwd(), 'apps', 'builder', 'public');
}

function normalizePartialImageCount(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '2', 10);
  if (!Number.isFinite(parsed)) return 2;
  return Math.max(0, Math.min(3, parsed));
}

function imageDataUrl(base64: string, format: 'png' | 'jpeg' | 'webp'): string {
  return `data:${imageMimeType(format)};base64,${base64}`;
}

function imageMimeType(format: 'png' | 'jpeg' | 'webp'): string {
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  return 'image/jpeg';
}

const localizedBookSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
  },
};

const localizedPageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['content', 'narrationText'],
  properties: {
    content: { type: 'string' },
    narrationText: { type: 'string' },
  },
};

const languageProperties = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((language: BuilderLanguage) => [
    language,
    localizedBookSchema,
  ]),
);

const pageLanguageProperties = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((language: BuilderLanguage) => [
    language,
    localizedPageSchema,
  ]),
);

const generatedCharacterJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'imageUrl', 'role', 'appearance', 'details'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    imageUrl: { type: 'string' },
    role: { type: 'string' },
    appearance: { type: 'string' },
    details: { type: 'string' },
  },
};

const generatedPageJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['imagePrompt', 'characterIds', 'game', 'localizations'],
  properties: {
    imagePrompt: { type: 'string' },
    characterIds: {
      type: 'array',
      items: { type: 'string' },
    },
    game: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'prompt', 'configJson', 'narrationJson'],
          properties: {
            id: { type: 'string' },
            prompt: { type: 'string' },
            configJson: { type: 'string' },
            narrationJson: { type: 'string' },
          },
        },
      ],
    },
    localizations: {
      type: 'object',
      additionalProperties: false,
      required: SUPPORTED_LANGUAGES,
      properties: pageLanguageProperties,
    },
  },
};

const generatedBookJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'ageMin',
    'ageMax',
    'stylePrompt',
    'coverImagePrompt',
    'characters',
    'localizations',
    'pages',
  ],
  properties: {
    ageMin: { type: 'integer' },
    ageMax: { type: 'integer' },
    stylePrompt: { type: 'string' },
    coverImagePrompt: { type: 'string' },
    characters: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: generatedCharacterJsonSchema,
    },
    localizations: {
      type: 'object',
      additionalProperties: false,
      required: SUPPORTED_LANGUAGES,
      properties: languageProperties,
    },
    pages: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: generatedPageJsonSchema,
    },
  },
};
