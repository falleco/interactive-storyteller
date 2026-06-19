import { type NextRequest, NextResponse } from 'next/server';
import {
  deleteArchivedBuilderBook,
  getBuilderBookPayload,
  saveBuilderBook,
} from '~/lib/curated-books';
import { assertBuilderAccess, jsonError } from '~/lib/http';
import type { BuilderBookPayload } from '~/lib/types';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id } = await context.params;
    const payload = await getBuilderBookPayload(id);
    if (!payload) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id } = await context.params;
    const body = (await request.json()) as BuilderBookPayload;
    return NextResponse.json(await saveBuilderBook(id, body));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id } = await context.params;
    await deleteArchivedBuilderBook(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
