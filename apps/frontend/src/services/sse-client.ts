import { authToken } from "./auth-token.js";

interface SseClientOptions {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  onEvent: (eventType: string, data: string, id: string) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  signal?: AbortSignal;
  lastEventId?: string;
}

export const createSseClient = async (options: SseClientOptions) => {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  };

  const token = authToken.get();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (options.lastEventId) {
    headers["Last-Event-ID"] = options.lastEventId;
  }

  const response = await fetch(options.url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`SSE request failed: ${response.status} ${text}`);
  }

  if (!response.body) {
    throw new Error("SSE response has no body");
  }

  options.onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType = "message";
  let currentData = "";
  let currentId = "";

  const processLine = (line: string) => {
    if (line === "") {
      // Empty line = end of event
      if (currentData) {
        options.onEvent(currentEventType, currentData.trimEnd(), currentId);
      }
      currentEventType = "message";
      currentData = "";
      currentId = "";
      return;
    }

    if (line.startsWith(":")) {
      // Comment, ignore
      return;
    }

    const colonIndex = line.indexOf(":");
    let field: string;
    let value: string;

    if (colonIndex === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colonIndex);
      value = line.slice(colonIndex + 1);
      if (value.startsWith(" ")) {
        value = value.slice(1);
      }
    }

    if (field === "event") {
      currentEventType = value;
    } else if (field === "data") {
      currentData += `${value}\n`;
    } else if (field === "id") {
      currentId = value;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        processLine(line);
      }
    }

    // Process any remaining data in buffer
    if (buffer) {
      processLine(buffer);
      processLine(""); // Flush any pending event
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
};
