import { type NextRequest, NextResponse } from 'next/server';
import { publishBuilderBook } from '~/lib/curated-books';
import { assertBuilderAccess, jsonError } from '~/lib/http';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id } = await context.params;
    return NextResponse.json(await publishBuilderBook(id));
  } catch (error) {
    return jsonError(error);
  }
}
