import type { VolcengineChatCompletionChunk } from "../types.js";

/**
 * Parse an SSE stream from a fetch Response into Volcengine chat completion chunks.
 */
export const parseSSEStream = async function* (
  response: Response,
): AsyncGenerator<VolcengineChatCompletionChunk> {
  for await (const { data } of parseRawSSEEvents(response)) {
    if (data === "[DONE]") return;
    try {
      yield JSON.parse(data) as VolcengineChatCompletionChunk;
    } catch {
      // Skip malformed JSON
    }
  }
};

/**
 * Generic SSE event parser. Yields objects with optional `event` and `data` fields.
 */
export const parseRawSSEEvents = async function* (
  response: Response,
): AsyncGenerator<{ event?: string; data: string }> {
  const body = response.body;
  if (!body) {
    throw new Error("Response body is null");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (separated by double newline)
      const events = buffer.split("\n\n");
      // Keep the last incomplete part in the buffer
      buffer = events.pop() ?? "";

      for (const event of events) {
        const parsed = parseSSEEvent(event);
        if (parsed) {
          yield parsed;
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const parsed = parseSSEEvent(buffer);
      if (parsed) {
        yield parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
};

const parseSSEEvent = (event: string): { event?: string; data: string } | null => {
  let eventType: string | undefined;
  const dataLines: string[] = [];

  for (const line of event.split("\n")) {
    // Skip comment lines and empty lines
    if (line.startsWith(":") || line.trim() === "") {
      continue;
    }

    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;

  const data = dataLines.join("\n");
  if (data === "[DONE]") {
    return { event: eventType, data: "[DONE]" };
  }

  return { event: eventType, data };
};
