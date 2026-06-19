import {
  STORY_GAME_NARRATION_CUES,
  type StoryGameNarrationCueId,
} from '@wondertales/shared/games';
import { type NextRequest, NextResponse } from 'next/server';
import {
  generateGameNarrationCueAudio,
  generateNarrationBlockAudio,
} from '~/lib/curated-books';
import { assertBuilderAccess, jsonError } from '~/lib/http';
import { type BuilderLanguage, SUPPORTED_LANGUAGES } from '~/lib/types';

type RouteContext = { params: Promise<{ id: string; pageId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id, pageId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      language?: string;
      blockId?: string;
      cueId?: string;
      regenerate?: boolean;
    };
    const language = normalizeLanguage(body.language);

    if (body.cueId) {
      const cueId = parseCueId(body.cueId);
      if (!cueId) {
        return NextResponse.json(
          { error: 'Unsupported game narration cue' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        await generateGameNarrationCueAudio({
          bookId: id,
          pageId,
          language,
          cueId,
          regenerate: body.regenerate ?? false,
        }),
      );
    }

    if (body.blockId) {
      return NextResponse.json(
        await generateNarrationBlockAudio({
          bookId: id,
          pageId,
          language,
          blockId: body.blockId,
          regenerate: body.regenerate ?? false,
        }),
      );
    }

    return NextResponse.json(
      { error: 'Narration block id or game cue id is required' },
      { status: 400 },
    );
  } catch (error) {
    return jsonError(error);
  }
}

function parseCueId(value: string): StoryGameNarrationCueId | null {
  if (
    STORY_GAME_NARRATION_CUES.some(
      (cue) => cue.id === (value as StoryGameNarrationCueId),
    )
  ) {
    return value as StoryGameNarrationCueId;
  }
  return null;
}

function normalizeLanguage(value: string | undefined): BuilderLanguage {
  return SUPPORTED_LANGUAGES.includes(value as BuilderLanguage)
    ? (value as BuilderLanguage)
    : 'en';
}
