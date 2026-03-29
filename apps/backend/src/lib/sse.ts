/**
 * SSE stream helpers for Hono.
 */
export const formatSseEvent = (id: string, event: string, data: unknown) => {
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
};

export const createSseStream = (onStream: (send: SseSender) => Promise<void>) => {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let closed = false;

      const send: SseSender = (id, event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSseEvent(id, event, data)));
        } catch {
          closed = true;
        }
      };

      try {
        await onStream(send);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send("error", "error", { error: message, code: "INTERNAL_ERROR" });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Controller already closed
          }
        }
      }
    },
  });
};

export type SseSender = (id: string, event: string, data: unknown) => void;

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;
