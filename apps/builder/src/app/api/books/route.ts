import { type NextRequest, NextResponse } from 'next/server';
import { generateCuratedBook } from '~/lib/ai';
import {
  createBuilderBook,
  deleteDraftBuilderBook,
  listBuilderBooks,
  replaceWithGeneratedBook,
} from '~/lib/curated-books';
import { assertBuilderAccess, jsonError } from '~/lib/http';

export async function GET(request: NextRequest) {
  try {
    assertBuilderAccess(request);
    return NextResponse.json(await listBuilderBooks());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertBuilderAccess(request);
    const body = (await request.json().catch(() => ({}))) as {
      brief?: string;
      prompt?: string;
      title?: string;
    };
    const brief = (body.brief ?? body.prompt ?? '').trim();
    if (!brief) {
      return NextResponse.json(
        { error: 'Story brief is required' },
        { status: 400 },
      );
    }
    const draft = await createBuilderBook({
      prompt: brief,
      title: body.title,
    });
    try {
      const generated = await generateCuratedBook(draft);
      return NextResponse.json(
        await replaceWithGeneratedBook(draft.id, generated, {
          updateSlugFromTitle: true,
        }),
      );
    } catch (error) {
      await deleteDraftBuilderBook(draft.id);
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
