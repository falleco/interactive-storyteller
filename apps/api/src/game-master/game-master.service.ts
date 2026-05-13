import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import type { Message } from '../ai/types';
import {
  buildClassicSystemPrompt,
  buildClassicUserPrompt,
  buildInteractiveSystemPrompt,
  buildInteractiveUserPrompt,
  buildStoryBibleSystemPrompt,
  buildStoryBibleUserPrompt,
  STORY_PAGE_COUNT,
} from './prompts';
import type {
  GenerateClassicStoryInput,
  GeneratedInteractivePage,
  GeneratedStory,
  GeneratedStoryBible,
  GenerateInteractivePageInput,
  GenerateStoryBibleInput,
  InteractiveChoice,
  StoryBible,
} from './types';

@Injectable()
export class GameMasterService {
  private readonly logger = new Logger(GameMasterService.name);

  constructor(private readonly ai: AiService) {}

  /**
   * Generate the canonical "story bible" for a new book. One LLM call, called
   * before any pages exist; the result is persisted on the Book row and
   * passed back into every subsequent page/image generation.
   */
  async generateStoryBible(
    input: GenerateStoryBibleInput,
  ): Promise<GeneratedStoryBible> {
    const messages: Message[] = [
      { role: 'system', content: buildStoryBibleSystemPrompt(input.language) },
      {
        role: 'user',
        content: buildStoryBibleUserPrompt({
          theme: input.theme,
          child: input.child,
        }),
      },
    ];

    const result = await this.ai.generateText({
      messages,
      temperature: 0.9,
      maxTokens: 1200,
    });

    const bible = parseStoryBibleJson(result.content);
    return { bible, usage: result.usage };
  }

  /**
   * Generate a full classic-mode story (N pages with scene-only image prompts)
   * grounded by the provided bible. The bible drives style + character look
   * consistency.
   */
  async generateClassic(
    input: GenerateClassicStoryInput,
  ): Promise<GeneratedStory> {
    const messages: Message[] = [
      { role: 'system', content: buildClassicSystemPrompt(input.language) },
      {
        role: 'user',
        content: buildClassicUserPrompt({
          bible: input.bible,
          theme: input.theme,
          child: input.child,
        }),
      },
    ];

    const result = await this.ai.generateText({
      messages,
      temperature: 0.9,
      maxTokens: 2000,
    });

    const parsed = parseClassicStoryJson(result.content);

    if (parsed.pages.length !== STORY_PAGE_COUNT) {
      this.logger.warn(
        `Expected ${STORY_PAGE_COUNT} pages, got ${parsed.pages.length}; using what was returned`,
      );
    }

    return { ...parsed, usage: result.usage };
  }

  /**
   * Generate ONE interactive page given the bible + history so far. The page
   * number is derived from `previousPages.length + 1`. The bible is fixed
   * upstream so character look and world stay consistent.
   */
  async generateInteractivePage(
    input: GenerateInteractivePageInput,
  ): Promise<GeneratedInteractivePage> {
    const messages: Message[] = [
      {
        role: 'system',
        content: buildInteractiveSystemPrompt(input.language),
      },
      {
        role: 'user',
        content: buildInteractiveUserPrompt({
          bible: input.bible,
          previousPages: input.previousPages,
        }),
      },
    ];

    const result = await this.ai.generateText({
      messages,
      temperature: 0.9,
      maxTokens: 1200,
    });

    const pageNumber = (input.previousPages?.length ?? 0) + 1;
    const parsed = parseInteractivePageJson(result.content, pageNumber);
    return { ...parsed, usage: result.usage };
  }
}

// ============================================================================
// Parsers
// ============================================================================

interface RawBibleJson {
  title?: unknown;
  world?: unknown;
  mainCharacters?: unknown;
  otherCharacters?: unknown;
  style?: unknown;
  theme?: unknown;
  coverImagePrompt?: unknown;
}

function parseStoryBibleJson(raw: string): StoryBible {
  const cleaned = stripCodeFences(raw.trim());
  let parsed: RawBibleJson;
  try {
    parsed = JSON.parse(cleaned) as RawBibleJson;
  } catch (error) {
    throw new Error(
      `Story bible JSON parse failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const required = [
    'title',
    'world',
    'mainCharacters',
    'style',
    'coverImagePrompt',
  ] as const;
  for (const key of required) {
    if (
      typeof parsed[key] !== 'string' ||
      (parsed[key] as string).trim() === ''
    ) {
      throw new Error(`Story bible JSON missing or empty "${key}"`);
    }
  }

  return {
    title: (parsed.title as string).trim(),
    world: (parsed.world as string).trim(),
    mainCharacters: (parsed.mainCharacters as string).trim(),
    otherCharacters:
      typeof parsed.otherCharacters === 'string'
        ? parsed.otherCharacters.trim()
        : '',
    style: (parsed.style as string).trim(),
    theme: typeof parsed.theme === 'string' ? parsed.theme.trim() : '',
    coverImagePrompt: (parsed.coverImagePrompt as string).trim(),
  };
}

interface RawClassicStoryJson {
  pages?: unknown;
}

function parseClassicStoryJson(raw: string): Omit<GeneratedStory, 'usage'> {
  const cleaned = stripCodeFences(raw.trim());
  let parsed: RawClassicStoryJson;
  try {
    parsed = JSON.parse(cleaned) as RawClassicStoryJson;
  } catch (error) {
    throw new Error(
      `GameMaster returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error('GameMaster JSON is missing "pages"');
  }

  const pages = parsed.pages.map((rawPage, index) => {
    if (!rawPage || typeof rawPage !== 'object') {
      throw new Error(`GameMaster page ${index + 1} is not an object`);
    }
    const page = rawPage as {
      title?: unknown;
      content?: unknown;
      imagePrompt?: unknown;
    };
    if (typeof page.title !== 'string' || page.title.trim() === '') {
      throw new Error(`GameMaster page ${index + 1} is missing "title"`);
    }
    if (typeof page.content !== 'string' || page.content.trim() === '') {
      throw new Error(`GameMaster page ${index + 1} is missing "content"`);
    }
    if (typeof page.imagePrompt !== 'string') {
      throw new Error(`GameMaster page ${index + 1} is missing "imagePrompt"`);
    }
    return {
      title: page.title.trim(),
      content: page.content.trim(),
      imagePrompt: page.imagePrompt.trim(),
    };
  });

  return { pages };
}

interface RawInteractivePageJson {
  title?: unknown;
  content?: unknown;
  imagePrompt?: unknown;
  choices?: unknown;
  choiceImagePrompts?: unknown;
}

function parseInteractivePageJson(
  raw: string,
  pageNumber: number,
): Omit<GeneratedInteractivePage, 'usage'> {
  const cleaned = stripCodeFences(raw.trim());
  let parsed: RawInteractivePageJson;
  try {
    parsed = JSON.parse(cleaned) as RawInteractivePageJson;
  } catch (error) {
    throw new Error(
      `GameMaster returned invalid interactive JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (typeof parsed.title !== 'string' || parsed.title.trim() === '') {
    throw new Error('Interactive page is missing "title"');
  }
  if (typeof parsed.content !== 'string' || parsed.content.trim() === '') {
    throw new Error('Interactive page is missing "content"');
  }
  if (typeof parsed.imagePrompt !== 'string') {
    throw new Error('Interactive page is missing "imagePrompt"');
  }

  const rawChoices = Array.isArray(parsed.choices) ? parsed.choices : [];
  const rawChoiceImages = Array.isArray(parsed.choiceImagePrompts)
    ? parsed.choiceImagePrompts
    : [];

  if (pageNumber < STORY_PAGE_COUNT && rawChoices.length === 0) {
    throw new Error(`Interactive page ${pageNumber} must have choices (got 0)`);
  }

  const choices: InteractiveChoice[] =
    pageNumber === STORY_PAGE_COUNT
      ? []
      : rawChoices.map((label, idx) => {
          if (typeof label !== 'string' || label.trim() === '') {
            throw new Error(
              `Interactive page ${pageNumber} choice ${idx + 1} has no label`,
            );
          }
          const promptRaw = rawChoiceImages[idx];
          const imagePrompt = typeof promptRaw === 'string' ? promptRaw : '';
          return {
            label: label.trim(),
            imagePrompt: imagePrompt.trim(),
          };
        });

  return {
    title: parsed.title.trim(),
    content: parsed.content.trim(),
    imagePrompt: parsed.imagePrompt.trim(),
    choices,
  };
}

function stripCodeFences(value: string): string {
  if (value.startsWith('```')) {
    const lines = value.split('\n');
    if (lines.length >= 2) {
      const last = lines[lines.length - 1]?.trim();
      if (last === '```' || last?.startsWith('```')) {
        return lines.slice(1, -1).join('\n');
      }
    }
  }
  return value;
}
