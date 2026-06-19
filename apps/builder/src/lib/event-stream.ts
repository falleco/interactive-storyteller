type EventStreamSender = (event: string, data: unknown) => void;

export function eventStream(
  producer: (send: EventStreamSender) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: EventStreamSender = (event, data) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        await producer(send);
      } catch (error) {
        send('error', {
          error: error instanceof Error ? error.message : 'Unexpected error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8',
      'x-accel-buffering': 'no',
    },
  });
}

export function acceptsEventStream(request: Request): boolean {
  return request.headers.get('accept')?.includes('text/event-stream') ?? false;
}
