import type { Language } from '../storytellers/storyteller-catalog';
import type { StoryBible } from './types';

export const STORY_PAGE_COUNT = 5;

const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  fr: 'French',
  pt: 'Portuguese (Brazilian)',
  it: 'Italian',
};

const TITLE_RULES = `TITLE RULES:
- The book title must feel specific, memorable, and surprising, not generic.
- Avoid overused formula titles such as "The Enchanted Forest", "The Hidden Path", "A New Friend", "The Magic Adventure", "The Brave Little...", or any vague "The [adjective] [noun]" title that could fit thousands of stories.
- Do NOT default to broad theme-only titles about forests, castles, dreams, magic, friendship, adventures, or bedtime unless there is a fresh, concrete twist.
- Prefer titles with a distinctive hook: an unusual object, a curious event, a peculiar place, a playful promise, or a character-specific detail.
- Make the title feel original for THIS exact story, using the main character, central image, or core twist when helpful.
- Keep it short enough to feel like a real children's book title, but specific enough that it would stand out on a bookshelf.
- Page titles should also avoid repetition and generic fantasy filler. Each page title should reflect the unique moment on that page.`;

// ============================================================================
// STORY BIBLE — generated up-front, before any pages
// ============================================================================

export function buildStoryBibleSystemPrompt(language: Language): string {
  return `You are a children's story art director. Before any pages are written, you produce the canonical "story bible" — the consistent context every page and every illustration must respect.

Rules:
- Write the textual fields in ${LANGUAGE_LABELS[language]}, EXCEPT:
  - "style" stays in English (it feeds the image model directly).
  - "coverImagePrompt" stays in English (it feeds the image model directly).
- Be concrete and visual. Avoid vague phrases like "a magical world" — describe specific colors, light, atmosphere, signature elements.
- Match the style and tone to the target child's age and the theme (see picking guidance below).
${TITLE_RULES}

STYLE PICKING GUIDANCE (for the "style" field, in English):
- Children 2-4: soft crayon-style children's book illustration, simple shapes, bright primary colors, friendly faces, thick outlines.
- Children 5-7: pastel watercolor storybook illustration, gentle textures, warm lighting, expressive characters.
- Children 8-10: detailed but still child-friendly illustrated style, richer palette, dynamic compositions, painterly finish.
- Tune the style to the theme: princess/fairy-tale themes lean toward soft pastel watercolor with sparkles; adventure/space themes lean toward colorful, energetic illustration with bold shapes; calm/bedtime themes lean toward muted dreamy palettes.
- The "style" must be one or two short sentences usable as the prefix of every image prompt.

CHARACTER VISUAL CONSISTENCY (CRITICAL):
- "mainCharacters" must give a fixed, detailed look (species/type, hair, eyes, clothing with specific colors, accessories, mood). The same description will be reused on every page and every illustration — make it concrete enough that the image model produces the same look every time.
- "otherCharacters" lists supporting cast with names and key visual traits. Empty string if none yet.

COVER IMAGE PROMPT:
- "coverImagePrompt" must be a complete, self-contained scene description IN ENGLISH for the book cover. It must start with the chosen "style" sentence, then describe the main character (re-stating mainCharacters details), then the cover-worthy scene.
- The cover MUST be 100% wordless. ABSOLUTELY NO TEXT in the image, EVER, under any circumstance: no letters, no words, no numbers, no captions, no labels, no signs, no readable book pages, no title cards, no watermarks, no signatures, no typography of any kind, in any language, anywhere in the frame. End the coverImagePrompt with this exact sentence: "ABSOLUTELY NO TEXT in the image — no letters, words, numbers, signs, or typography of any kind, anywhere, in any language."

You MUST respond with valid JSON only — no markdown, no code fences. Use this exact structure:
{
  "title": "Book title",
  "world": "Description of the world, locations, atmosphere, colors, time of day, signature elements...",
  "mainCharacters": "Detailed fixed visual + personality description of the protagonist...",
  "otherCharacters": "Named supporting characters with their traits, or empty string",
  "style": "English art-style sentence usable as a prompt prefix",
  "theme": "What the story is about (lesson/feeling/concrete situation)",
  "coverImagePrompt": "Style sentence. Main character description. Cover scene description. No text in the image."
}`;
}

export function buildStoryBibleUserPrompt(input: {
  theme?: string;
  child?: { name: string; age: number; gender?: string | null };
}): string {
  const lines: string[] = [
    "Produce the story bible for a new children's book.",
  ];

  if (input.child) {
    const genderHint = input.child.gender ? ` (${input.child.gender})` : '';
    lines.push(
      `Target child reader: ${input.child.name}, age ${input.child.age}${genderHint}. Use this child as the main character.`,
    );
  } else {
    lines.push(
      'No specific child reader; invent a charming protagonist that fits the theme.',
    );
  }

  if (input.theme) {
    lines.push(`Theme/topic: ${input.theme}`);
  } else {
    lines.push(
      'No specific theme — invent something heartwarming and unusual that fits the target age.',
    );
  }

  return lines.join('\n');
}

// ============================================================================
// CLASSIC story pages — generated with the bible as fixed context
// ============================================================================

export function buildClassicSystemPrompt(language: Language): string {
  return `You are a children's storyteller writing the pages of a book whose canonical "story bible" has ALREADY been decided. Your job is to write the pages in a way that stays perfectly consistent with the bible.

Rules:
- Write each page's text in ${LANGUAGE_LABELS[language]}.
- Image prompts are written in English (they feed the image model).
- Each page should be 4-7 sentences long, simple and vivid for kids 2-10.
- Positive, heartwarming, no scary or violent content.
- Re-use the world, characters, and tone from the bible faithfully — no contradictions.
- Page titles must follow the bible's tone; each page title should reflect the unique moment on that page, not generic fantasy filler.

IMAGE PROMPTS:
- Each page MUST include an "imagePrompt" field in English describing JUST what happens on this page — the scene, the action, the mood. Be concrete.
- Do NOT repeat the style or the full character description in imagePrompt; the renderer prepends them.
- The illustration MUST be 100% wordless. ABSOLUTELY NO TEXT, EVER, in any image: no letters, words, numbers, captions, labels, signs, readable book pages, title cards, watermarks, signatures, or typography of any kind, in any language, anywhere in the frame. This rule has NO exceptions — do not invent scenarios that imply text (no characters reading visible books, no chalkboards with letters, no street signs, no name tags). If a scene naturally suggests text, describe it abstractly so the artist draws no glyphs (e.g. "an open book showing only colorful illustrations").

You MUST respond with valid JSON only — no markdown, no code fences. Use this exact structure:
{
  "pages": [
    { "title": "Page Title", "content": "Page content...", "imagePrompt": "Scene-only visual description for this page" }
  ]
}

Generate exactly ${STORY_PAGE_COUNT} pages.`;
}

export function buildClassicUserPrompt(input: {
  bible: StoryBible;
  theme?: string;
  child?: { name: string; age: number; gender?: string | null };
}): string {
  return [
    'Use this story bible as the fixed canon:',
    serializeBibleForPrompt(input.bible),
    '',
    'Now write the pages of the book in the language requested. Stay faithful to the bible.',
  ].join('\n');
}

// ============================================================================
// INTERACTIVE pages — one at a time, with the bible as fixed context
// ============================================================================

export function buildInteractiveSystemPrompt(language: Language): string {
  return `You are an interactive children's storyteller writing ONE page at a time for a book whose canonical "story bible" has ALREADY been decided. The reader picks choices that shape the story.

Rules:
- Write each page's text in ${LANGUAGE_LABELS[language]}.
- Image prompts are written in English (they feed the image model).
- Each page should be 4-7 sentences long, simple and vivid for kids 2-10.
- Positive, heartwarming, no scary or violent content.
- Re-use the world, characters, and tone from the bible faithfully — no contradictions.
- Each page (except the last) must include exactly 2 short choices written in ${LANGUAGE_LABELS[language]}. Choices should be fun, simple, and lead to different story directions.
- The last page (page ${STORY_PAGE_COUNT}) wraps up the story with a happy ending and has NO choices.

IMAGE PROMPTS:
- "imagePrompt" describes JUST the scene on this page (action, mood). English.
- "choiceImagePrompts" is an array of the same length as "choices", each describing what that branch leads to. English.
- Do NOT repeat the style or full character description; the renderer prepends them.
- Every image (page AND choice) MUST be 100% wordless. ABSOLUTELY NO TEXT, EVER, in any image: no letters, words, numbers, captions, labels, signs, readable book pages, title cards, watermarks, signatures, or typography of any kind, in any language, anywhere in the frame. This rule has NO exceptions — do not invent scenarios that imply text (no characters reading visible books, no chalkboards with letters, no street signs, no name tags). If a scene naturally suggests text, describe it abstractly so the artist draws no glyphs.

You MUST respond with valid JSON only — no markdown, no code fences.

PAGE shape:
{
  "title": "Page Title",
  "content": "Page content...",
  "imagePrompt": "Scene-only visual description for this page",
  "choices": ["Choice A", "Choice B"],
  "choiceImagePrompts": ["Visual scene for choice A...", "Visual scene for choice B..."]
}

FINAL page (page ${STORY_PAGE_COUNT}) uses empty arrays: "choices": [], "choiceImagePrompts": []`;
}

export function buildInteractiveUserPrompt(input: {
  bible: StoryBible;
  previousPages?: Array<{
    title: string;
    content: string;
    selectedChoiceLabel?: string;
  }>;
}): string {
  const previous = input.previousPages ?? [];
  const pageNumber = previous.length + 1;

  const lines: string[] = [
    'Use this story bible as the fixed canon:',
    serializeBibleForPrompt(input.bible),
    '',
    `We are generating page ${pageNumber} of ${STORY_PAGE_COUNT}.`,
  ];

  if (previous.length > 0) {
    lines.push('Previous pages and chosen paths:');
    for (let i = 0; i < previous.length; i += 1) {
      const page = previous[i];
      lines.push(`--- Page ${i + 1}: ${page.title} ---`);
      lines.push(page.content);
      if (page.selectedChoiceLabel) {
        lines.push(`Reader chose: ${page.selectedChoiceLabel}`);
      }
    }
  }

  if (pageNumber === STORY_PAGE_COUNT) {
    lines.push(
      'Write the FINAL page (no choices). Wrap up the story with a happy ending.',
    );
  } else {
    lines.push(
      `Write the next page (page ${pageNumber}) with two short choices.`,
    );
  }

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compose the final image prompt sent to the image model. Every image
 * (cover, page, choice) is anchored by the bible's style + world + main
 * character description for visual consistency, with the scene-specific
 * prompt appended.
 */
/**
 * Repeated at the start AND the end of every composed image prompt so the
 * image model treats "no readable glyphs anywhere" as a hard constraint, not
 * a stylistic preference. Phrased verbosely because diffusion models respond
 * better to explicit, varied formulations than to a single short rule.
 */
export const NO_TEXT_DIRECTIVE =
  'ABSOLUTELY NO TEXT in the image. Do not render any letters, words, numbers, captions, labels, signs, book pages with readable text, title cards, watermarks, signatures, or typography of any kind, in any language, anywhere in the frame. The illustration must be 100% wordless. This rule has NO exceptions.';

export function composeImagePrompt(
  bible: StoryBible,
  scene: string,
  extras?: { extraContext?: string },
): string {
  const parts = [
    NO_TEXT_DIRECTIVE,
    bible.style.trim(),
    `World: ${bible.world.trim()}`,
    `Main character: ${bible.mainCharacters.trim()}`,
  ];
  if (bible.otherCharacters?.trim()) {
    parts.push(`Other characters: ${bible.otherCharacters.trim()}`);
  }
  if (extras?.extraContext) {
    parts.push(extras.extraContext.trim());
  }
  parts.push(`Scene: ${scene.trim()}`);
  parts.push(NO_TEXT_DIRECTIVE);
  return parts.join(' ');
}

function serializeBibleForPrompt(bible: StoryBible): string {
  return [
    `- Title: ${bible.title}`,
    `- World: ${bible.world}`,
    `- Main character: ${bible.mainCharacters}`,
    bible.otherCharacters
      ? `- Other characters: ${bible.otherCharacters}`
      : '- Other characters: (introduce as the story unfolds; stay consistent once introduced)',
    `- Style (image-model prefix, English): ${bible.style}`,
    `- Narrative theme: ${bible.theme}`,
  ].join('\n');
}
