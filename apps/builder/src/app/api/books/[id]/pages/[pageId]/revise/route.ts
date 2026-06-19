import { type NextRequest, NextResponse } from 'next/server';
import { reviseBuilderPage } from '~/lib/curated-books';
import { assertBuilderAccess, jsonError } from '~/lib/http';

type RouteContext = { params: Promise<{ id: string; pageId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id, pageId } = await context.params;
    const body = (await request.json()) as { instruction?: string };
    return NextResponse.json(
      await reviseBuilderPage({
        bookId: id,
        pageId,
        instruction: body.instruction ?? '',
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
