import { type NextRequest, NextResponse } from 'next/server';
import { generatePageImageForBook } from '~/lib/curated-books';
import { acceptsEventStream, eventStream } from '~/lib/event-stream';
import { assertBuilderAccess, jsonError } from '~/lib/http';

type RouteContext = { params: Promise<{ id: string; pageId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id, pageId } = await context.params;
    if (acceptsEventStream(request)) {
      return eventStream(async (send) => {
        send('status', { message: 'Queued with OpenAI' });
        const payload = await generatePageImageForBook({
          bookId: id,
          pageId,
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
    return NextResponse.json(
      await generatePageImageForBook({ bookId: id, pageId }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
