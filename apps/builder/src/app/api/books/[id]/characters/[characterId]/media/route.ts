import { type NextRequest, NextResponse } from 'next/server';
import { generateCharacterImageForBook } from '~/lib/curated-books';
import { acceptsEventStream, eventStream } from '~/lib/event-stream';
import { assertBuilderAccess, jsonError } from '~/lib/http';

type RouteContext = {
  params: Promise<{ id: string; characterId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertBuilderAccess(request);
    const { id, characterId } = await context.params;
    if (acceptsEventStream(request)) {
      return eventStream(async (send) => {
        send('status', { message: 'Queued with OpenAI' });
        const payload = await generateCharacterImageForBook({
          bookId: id,
          characterId,
          onProgress: ({ imageUrl, index }) => {
            send('partial', { imageUrl, index });
          },
        });
        send('complete', payload);
      });
    }
    return NextResponse.json(
      await generateCharacterImageForBook({ bookId: id, characterId }),
    );
  } catch (error) {
    return jsonError(error);
  }
}
