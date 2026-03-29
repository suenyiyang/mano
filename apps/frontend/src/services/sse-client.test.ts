import { afterEach, describe, expect, it, vi } from "vitest";

// Mock localStorage for auth-token dependency
const store: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  },
});

import { createSseClient } from "./sse-client.js";

// Helper to create a readable stream from SSE text
const sseStream = (text: string): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
};

describe("createSseClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  });

  it("parses a single SSE event", async () => {
    const events: Array<{ type: string; data: string; id: string }> = [];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(sseStream('event: text_delta\ndata: {"text":"hi"}\n\n'), {
        status: 200,
      }),
    );

    await createSseClient({
      url: "/api/test",
      onEvent: (type, data, id) => events.push({ type, data, id }),
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "text_delta",
      data: '{"text":"hi"}',
      id: "",
    });
  });

  it("parses multiple SSE events", async () => {
    const events: Array<{ type: string; data: string; id: string }> = [];

    const sseText = [
      "event: response_start",
      'data: {"responseId":"r1"}',
      "",
      "event: text_delta",
      'data: {"text":"hello"}',
      "",
      "event: done",
      'data: {"usage":{}}',
      "",
      "",
    ].join("\n");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(sseStream(sseText)));

    await createSseClient({
      url: "/api/test",
      onEvent: (type, data, id) => events.push({ type, data, id }),
    });

    expect(events).toHaveLength(3);
    expect(events[0]?.type).toBe("response_start");
    expect(events[1]?.type).toBe("text_delta");
    expect(events[2]?.type).toBe("done");
  });

  it("parses events with id field", async () => {
    const events: Array<{ type: string; data: string; id: string }> = [];

    const sseText = 'id: 42\nevent: text_delta\ndata: {"text":"hi"}\n\n';

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(sseStream(sseText)));

    await createSseClient({
      url: "/api/test",
      onEvent: (type, data, id) => events.push({ type, data, id }),
    });

    expect(events[0]?.id).toBe("42");
  });

  it("ignores comment lines", async () => {
    const events: Array<{ type: string; data: string; id: string }> = [];

    const sseText = ": this is a comment\nevent: text_delta\ndata: ok\n\n";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(sseStream(sseText)));

    await createSseClient({
      url: "/api/test",
      onEvent: (type, data, id) => events.push({ type, data, id }),
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("text_delta");
  });

  it("uses default event type 'message' when no event field", async () => {
    const events: Array<{ type: string; data: string; id: string }> = [];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(sseStream("data: hello\n\n")));

    await createSseClient({
      url: "/api/test",
      onEvent: (type, data, id) => events.push({ type, data, id }),
    });

    expect(events[0]?.type).toBe("message");
    expect(events[0]?.data).toBe("hello");
  });

  it("concatenates multi-line data fields", async () => {
    const events: Array<{ type: string; data: string; id: string }> = [];

    const sseText = "event: msg\ndata: line1\ndata: line2\n\n";

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(sseStream(sseText)));

    await createSseClient({
      url: "/api/test",
      onEvent: (type, data, id) => events.push({ type, data, id }),
    });

    expect(events[0]?.data).toBe("line1\nline2");
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("rate limited", { status: 429 }),
    );

    await expect(
      createSseClient({
        url: "/api/test",
        onEvent: () => {},
      }),
    ).rejects.toThrow("SSE request failed: 429");
  });

  it("sends POST with body and auth header", async () => {
    store.mano_token = "test-token";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(sseStream("data: ok\n\n")));

    await createSseClient({
      url: "/api/chat/send",
      method: "POST",
      body: { content: "hello" },
      onEvent: () => {},
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat/send",
      expect.objectContaining({
        method: "POST",
        body: '{"content":"hello"}',
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("calls onOpen when connection is established", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(sseStream("data: ok\n\n")));

    const onOpen = vi.fn();

    await createSseClient({
      url: "/api/test",
      onEvent: () => {},
      onOpen,
    });

    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("sends Last-Event-ID header when provided", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(sseStream("data: ok\n\n")));

    await createSseClient({
      url: "/api/test",
      lastEventId: "99",
      onEvent: () => {},
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Last-Event-ID": "99",
        }),
      }),
    );
  });
});
