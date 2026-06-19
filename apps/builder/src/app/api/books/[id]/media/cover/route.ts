import { type NextRequest, NextResponse } from 'next/server';
import { generateCoverImageForBook } from '~/lib/curated-books';
import { acceptsEventStream, eventStream } from '~/lib/event-stream';
import { assertBuilderAccess, jsonError } from '~/lib/http';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id } = await context.params;
    if (acceptsEventStream(request)) {
      return eventStream(async (send) => {
        send('status', { message: 'Queued with OpenAI' });
        const payload = await generateCoverImageForBook(id, {
          onStatus: (message) => {
            send('status', { message });
          },
          onProgress: ({ imageUrl, index }) => {
            send('partial', { imageUrl, index });
          },
        });
        send('complete', payload);
      });
    }
    return NextResponse.json(await generateCoverImageForBook(id));
  } catch (error) {
    return jsonError(error);
  }
}
