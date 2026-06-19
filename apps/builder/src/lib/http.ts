import { type NextRequest, NextResponse } from 'next/server';

export function assertBuilderAccess(request: NextRequest): void {
  const secret = process.env.BUILDER_ADMIN_SECRET;
  if (!secret) return;

  const bearer = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');
  const explicit = request.headers.get('x-builder-secret');
  if (bearer === secret || explicit === secret) return;

  throw Object.assign(new Error('Unauthorized'), { status: 401 });
}

export function jsonError(error: unknown) {
  const status =
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : 500;
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return NextResponse.json({ error: message }, { status });
}
