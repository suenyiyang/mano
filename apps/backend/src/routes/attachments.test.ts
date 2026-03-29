// @ts-nocheck — test file with mocked responses
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app.js";

// Mock auth — inject userId directly
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
      c.set("userId", "test-user-id");
      c.set("userTier", "pro");
      await next();
    },
  ),
}));

const mockAttachments = [
  {
    id: "att-1",
    userId: "test-user-id",
    messageId: null,
    filename: "test.txt",
    mimeType: "text/plain",
    sizeBytes: 100,
    storageKey: "test-user-id/abc.txt",
    createdAt: new Date(),
  },
];

vi.mock("../db/queries/attachments.js", () => ({
  findAttachmentById: vi.fn(async (_db: unknown, id: string) => {
    if (id === "att-1") return mockAttachments[0];
    return null;
  }),
  insertAttachment: vi.fn(async (_db: unknown, input: Record<string, unknown>) => ({
    id: "att-new",
    ...input,
    createdAt: new Date(),
  })),
  deleteAttachment: vi.fn(async (_db: unknown, id: string) => {
    if (id === "att-1") return mockAttachments[0];
    return null;
  }),
}));

vi.mock("../lib/storage.js", () => ({
  getStorage: vi.fn(() => ({
    upload: vi.fn(async () => {}),
    download: vi.fn(async () => ({
      data: Buffer.from("hello world"),
      contentType: "text/plain",
    })),
    delete: vi.fn(async () => {}),
    getSignedUrl: vi.fn(async () => "http://example.com/signed"),
  })),
}));

const createTestApp = async () => {
  const { attachmentRoutes } = await import("./attachments.js");

  const app = new Hono<AppEnv>();
  app.onError((error, c) => {
    if ("status" in error && typeof (error as { status: unknown }).status === "number") {
      const status = (error as { status: number }).status;
      return c.json({ error: error.message }, status as 400 | 404 | 409);
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
  app.route("/api/attachments", attachmentRoutes);
  return app;
};

describe("Attachment routes", () => {
  it("POST /upload creates an attachment", async () => {
    const app = await createTestApp();

    const formData = new FormData();
    formData.append("file", new File(["hello"], "test.txt", { type: "text/plain" }));

    const res = await app.request("/api/attachments/upload", {
      method: "POST",
      headers: { authorization: "Bearer test" },
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.attachment.filename).toBe("test.txt");
    expect(body.attachment.mimeType).toBe("text/plain");
  });

  it("GET /:id/download returns file contents", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/attachments/att-1/download", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain");
    const text = await res.text();
    expect(text).toBe("hello world");
  });

  it("GET /:id/download returns 404 for unknown attachment", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/attachments/unknown/download", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(404);
  });

  it("POST /:id/delete removes an attachment", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/attachments/att-1/delete", {
      method: "POST",
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("POST /:id/delete returns 404 for unknown attachment", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/attachments/unknown/delete", {
      method: "POST",
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(404);
  });
});
