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

const mockServers = [
  {
    id: "srv-1",
    userId: "test-user-id",
    name: "test-stdio",
    transport: "stdio",
    command: "node",
    args: ["server.js"],
    url: null,
    env: null,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock("../db/queries/mcp-servers.js", () => ({
  findMcpServersByUser: vi.fn(async () => mockServers),
  findMcpServerById: vi.fn(async (_db: unknown, id: string) => {
    if (id === "srv-1") return mockServers[0];
    return null;
  }),
  insertMcpServer: vi.fn(async (_db: unknown, input: Record<string, unknown>) => ({
    id: "srv-new",
    ...input,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateMcpServer: vi.fn(async (_db: unknown, _id: string, input: Record<string, unknown>) => ({
    ...mockServers[0],
    ...input,
    updatedAt: new Date(),
  })),
  deleteMcpServer: vi.fn(async () => {}),
  findEnabledMcpServersByUser: vi.fn(async () => []),
}));

const createTestApp = async () => {
  const { mcpServerRoutes } = await import("./mcp-servers.js");

  const app = new Hono<AppEnv>();
  // Hono onError handler — catches errors from sub-routes
  app.onError((error, c) => {
    // Check for HttpError by duck-typing (instanceof unreliable across module boundaries)
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
  app.route("/api/mcp-servers", mcpServerRoutes);
  return app;
};

describe("MCP Server routes", () => {
  it("GET /list returns user's MCP servers", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/list", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mcpServers).toHaveLength(1);
    expect(body.mcpServers[0].name).toBe("test-stdio");
  });

  it("POST /create creates a stdio MCP server", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/create", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "my-server",
        transport: "stdio",
        command: "python",
        args: ["-m", "server"],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.mcpServer.name).toBe("my-server");
  });

  it("POST /create rejects stdio without command", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/create", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "bad-server",
        transport: "stdio",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("command");
  });

  it("POST /create rejects sse without url", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/create", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "bad-sse",
        transport: "sse",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("url");
  });

  it("POST /:id/update updates an MCP server", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/srv-1/update", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "renamed-server" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mcpServer.name).toBe("renamed-server");
  });

  it("POST /:id/update returns 404 for unknown server", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/unknown/update", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "x" }),
    });

    expect(res.status).toBe(404);
  });

  it("POST /:id/delete removes an MCP server", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/srv-1/delete", {
      method: "POST",
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("POST /:id/delete returns 404 for unknown server", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/unknown/delete", {
      method: "POST",
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(404);
  });

  it("POST /create rejects invalid transport", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/mcp-servers/create", {
      method: "POST",
      headers: {
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "bad",
        transport: "invalid",
        command: "x",
      }),
    });

    // Zod validation rejects invalid enum
    expect(res.status).toBe(400);
  });
});
