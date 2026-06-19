import { type NextRequest, NextResponse } from 'next/server';
import { generateAudioForBook } from '~/lib/curated-books';
import { assertBuilderAccess, jsonError } from '~/lib/http';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      regenerate?: boolean;
    };
    return NextResponse.json(
      await generateAudioForBook(id, { regenerate: body.regenerate ?? false }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
