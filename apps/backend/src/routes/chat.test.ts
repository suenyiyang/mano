// @ts-nocheck — test file with mocked responses
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app.js";

const TEST_USER_ID = "user-1";
const TEST_SESSION_ID = "session-1";
const TEST_RESPONSE_ID = "resp_abc123";

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
      c.set("userId", TEST_USER_ID);
      c.set("userTier", "pro");
      await next();
    },
  ),
}));

vi.mock("../middleware/rate-limit.js", () => ({
  rateLimitMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

const mockSession = {
  id: TEST_SESSION_ID,
  userId: TEST_USER_ID,
  title: "Test",
  systemPrompt: "",
  modelTier: "pro",
};

const mockGeneration = {
  responseId: TEST_RESPONSE_ID,
  sessionId: TEST_SESSION_ID,
  status: "running",
  startedAt: new Date(),
  completedAt: null,
};

vi.mock("../db/queries/sessions.js", () => ({
  findSessionById: vi.fn(async (_db: unknown, id: string) => {
    if (id === TEST_SESSION_ID) return mockSession;
    return null;
  }),
}));

vi.mock("../db/queries/active-generations.js", () => ({
  findActiveGeneration: vi.fn(async () => null),
  findGenerationByResponseId: vi.fn(async (_db: unknown, responseId: string) => {
    if (responseId === TEST_RESPONSE_ID) return mockGeneration;
    return null;
  }),
  acquireGenerationLock: vi.fn(async () => ({
    responseId: "resp_test",
    sessionId: TEST_SESSION_ID,
    status: "running",
    startedAt: new Date(),
    completedAt: null,
  })),
  insertActiveGeneration: vi.fn(async () => ({})),
  updateGenerationStatus: vi.fn(async () => {}),
}));

vi.mock("../db/queries/messages.js", () => ({
  findAllMessagesBySession: vi.fn(async () => []),
  getNextOrdinal: vi.fn(async () => 1),
  insertMessage: vi.fn(async () => ({})),
}));

vi.mock("../lib/model-config.js", () => ({
  getModelConfig: vi.fn(() => ({
    provider: "openai",
    apiModelId: "gpt-4o",
    displayName: "GPT-4o",
  })),
}));

vi.mock("../db/queries/sse-events.js", () => ({
  insertSseEvent: vi.fn(async () => ({ id: 1 })),
  findEventsAfter: vi.fn(async () => []),
}));

vi.mock("../lib/agent.js", () => ({
  createAgentForSession: vi.fn(async () => ({
    agent: { streamEvents: vi.fn(() => []) },
    mcpManager: null,
  })),
  createModelInstance: vi.fn(() => ({})),
  dbMessagesToLangChain: vi.fn(() => []),
}));

vi.mock("../lib/id.js", () => ({
  generateResponseId: vi.fn(() => "resp_test"),
}));

vi.mock("../lib/sse.js", () => ({
  SSE_HEADERS: { "content-type": "text/event-stream" },
  createSseStream: vi.fn(() => new ReadableStream()),
}));

const createTestApp = async () => {
  const { chatRoutes } = await import("./chat.js");
  const app = new Hono<AppEnv>();
  app.onError((error, c) => {
    if ("status" in error && typeof (error as { status: unknown }).status === "number") {
      return c.json(
        { error: error.message },
        (error as { status: number }).status as 400 | 404 | 409,
      );
    }
    if (error.constructor.name === "ZodError") {
      return c.json({ error: "Validation failed" }, 400);
    }
    return c.json({ error: "Internal server error" }, 500);
  });
  app.use("/*", async (c, next) => {
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/sessions", chatRoutes);
  return app;
};

const jsonPost = (url: string, body: unknown) => ({
  method: "POST" as const,
  headers: {
    authorization: "Bearer test",
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
});

describe("chat/terminate", () => {
  it("returns success for valid generation", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/terminate`,
      jsonPost("", { responseId: TEST_RESPONSE_ID }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 404 for unknown session", async () => {
    const app = await createTestApp();
    const res = await app.request(
      "/api/sessions/unknown/chat/terminate",
      jsonPost("", { responseId: TEST_RESPONSE_ID }),
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown generation", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/terminate`,
      jsonPost("", { responseId: "resp_nonexistent" }),
    );

    expect(res.status).toBe(404);
  });

  it("rejects missing responseId", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/terminate`,
      jsonPost("", {}),
    );

    expect(res.status).toBe(400);
  });
});

describe("chat/respond", () => {
  it("returns 404 for unknown session", async () => {
    const app = await createTestApp();
    const res = await app.request(
      "/api/sessions/unknown/chat/respond",
      jsonPost("", {
        responseId: TEST_RESPONSE_ID,
        toolCallId: "tc1",
        type: "ask_user_answer",
        payload: { answer: "hello" },
      }),
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown generation", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/respond`,
      jsonPost("", {
        responseId: "resp_nonexistent",
        toolCallId: "tc1",
        type: "ask_user_answer",
        payload: { answer: "hello" },
      }),
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when no pending question for ask_user_answer", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/respond`,
      jsonPost("", {
        responseId: TEST_RESPONSE_ID,
        toolCallId: "tc1",
        type: "ask_user_answer",
        payload: { answer: "hello" },
      }),
    );

    // No pending ask_user for this responseId
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No pending question");
  });

  it("returns 400 when no pending approval for hitl_approval", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/respond`,
      jsonPost("", {
        responseId: TEST_RESPONSE_ID,
        toolCallId: "tc1",
        type: "hitl_approval",
        payload: { approved: true },
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No pending approval");
  });

  it("returns 400 for generation that is not running", async () => {
    const { findGenerationByResponseId } = await import("../db/queries/active-generations.js");
    vi.mocked(findGenerationByResponseId).mockResolvedValueOnce({
      responseId: TEST_RESPONSE_ID,
      sessionId: TEST_SESSION_ID,
      status: "completed",
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/respond`,
      jsonPost("", {
        responseId: TEST_RESPONSE_ID,
        toolCallId: "tc1",
        type: "ask_user_answer",
        payload: { answer: "hello" },
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not in progress");
  });

  it("validates request body schema", async () => {
    const app = await createTestApp();

    // Missing required fields
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/respond`,
      jsonPost("", { responseId: TEST_RESPONSE_ID }),
    );

    expect(res.status).toBe(400);
  });

  it("rejects invalid response type", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/respond`,
      jsonPost("", {
        responseId: TEST_RESPONSE_ID,
        toolCallId: "tc1",
        type: "invalid_type",
        payload: {},
      }),
    );

    expect(res.status).toBe(400);
  });
});

describe("chat/send", () => {
  it("returns 200 SSE stream with configured model", async () => {
    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/send`,
      jsonPost("", { content: "Hello" }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("returns 409 when generation already in progress", async () => {
    const { acquireGenerationLock } = await import("../db/queries/active-generations.js");
    vi.mocked(acquireGenerationLock).mockResolvedValueOnce(null);

    const app = await createTestApp();
    const res = await app.request(
      `/api/sessions/${TEST_SESSION_ID}/chat/send`,
      jsonPost("", { content: "Hello" }),
    );

    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown session", async () => {
    const app = await createTestApp();
    const res = await app.request(
      "/api/sessions/unknown/chat/send",
      jsonPost("", { content: "Hello" }),
    );

    expect(res.status).toBe(404);
  });
});

describe("chat/active", () => {
  it("returns active false when no generation", async () => {
    const app = await createTestApp();
    const res = await app.request(`/api/sessions/${TEST_SESSION_ID}/chat/active`, {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(false);
  });

  it("returns active true with responseId when generation exists", async () => {
    const { findActiveGeneration } = await import("../db/queries/active-generations.js");
    vi.mocked(findActiveGeneration).mockResolvedValueOnce({
      responseId: TEST_RESPONSE_ID,
      sessionId: TEST_SESSION_ID,
      status: "running",
      startedAt: new Date(),
      completedAt: null,
    });

    const app = await createTestApp();
    const res = await app.request(`/api/sessions/${TEST_SESSION_ID}/chat/active`, {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.responseId).toBe(TEST_RESPONSE_ID);
  });

  it("returns 404 for unknown session", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/sessions/unknown/chat/active", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(404);
  });
});
