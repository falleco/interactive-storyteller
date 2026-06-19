import { type NextRequest, NextResponse } from 'next/server';
import { generateCuratedBook } from '~/lib/ai';
import {
  getBuilderBookPayload,
  replaceWithGeneratedBook,
} from '~/lib/curated-books';
import { assertBuilderAccess, jsonError } from '~/lib/http';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id } = await context.params;
    const book = await getBuilderBookPayload(id);
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    const generated = await generateCuratedBook(book);
    return NextResponse.json(await replaceWithGeneratedBook(id, generated));
  } catch (error) {
    return jsonError(error);
  }
}
