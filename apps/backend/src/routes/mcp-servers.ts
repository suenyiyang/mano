import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import {
  deleteMcpServer,
  findMcpServerById,
  findMcpServersByUser,
  insertMcpServer,
  updateMcpServer,
} from "../db/queries/mcp-servers.js";
import { authMiddleware } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../middleware/error-handler.js";

const createMcpServerSchema = z.object({
  name: z.string().min(1),
  transport: z.enum(["stdio", "sse", "streamable-http"]),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  env: z.record(z.string()).optional(),
});

const updateMcpServerSchema = z.object({
  name: z.string().min(1).optional(),
  transport: z.enum(["stdio", "sse", "streamable-http"]).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  env: z.record(z.string()).optional(),
  isEnabled: z.boolean().optional(),
});

export const mcpServerRoutes = new Hono<AppEnv>();

mcpServerRoutes.use("/*", authMiddleware);

mcpServerRoutes.get("/list", async (c) => {
  const db = c.var.db;
  const servers = await findMcpServersByUser(db, c.var.userId);
  return c.json({ mcpServers: servers });
});

mcpServerRoutes.post("/create", async (c) => {
  const db = c.var.db;
  const body = createMcpServerSchema.parse(await c.req.json());

  if (body.transport === "stdio" && !body.command) {
    throw badRequest("stdio transport requires a command");
  }
  if ((body.transport === "sse" || body.transport === "streamable-http") && !body.url) {
    throw badRequest(`${body.transport} transport requires a url`);
  }

  const server = await insertMcpServer(db, {
    userId: c.var.userId,
    ...body,
  });
  return c.json({ mcpServer: server }, 201);
});

mcpServerRoutes.post("/:id/update", async (c) => {
  const db = c.var.db;
  const existing = await findMcpServerById(db, c.req.param("id"));
  if (!existing) {
    throw notFound("MCP server not found");
  }
  if (existing.userId !== c.var.userId) {
    throw forbidden();
  }

  const body = updateMcpServerSchema.parse(await c.req.json());
  const server = await updateMcpServer(db, existing.id, body);
  return c.json({ mcpServer: server });
});

mcpServerRoutes.post("/:id/delete", async (c) => {
  const db = c.var.db;
  const existing = await findMcpServerById(db, c.req.param("id"));
  if (!existing) {
    throw notFound("MCP server not found");
  }
  if (existing.userId !== c.var.userId) {
    throw forbidden();
  }

  await deleteMcpServer(db, existing.id);
  return c.json({ success: true });
});
