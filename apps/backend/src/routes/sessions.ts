import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import {
  deleteSession,
  findSessionById,
  findSessionsByUser,
  forkSession,
  insertSession,
  updateSession,
} from "../db/queries/sessions.js";
import { authMiddleware } from "../middleware/auth.js";
import { forbidden, notFound } from "../middleware/error-handler.js";

const createSessionSchema = z.object({
  title: z.string().optional(),
  modelTier: z.string().default("pro"),
  systemPrompt: z.string().optional(),
});

const updateSessionSchema = z.object({
  title: z.string().optional(),
  modelTier: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const forkSessionSchema = z.object({
  afterMessageId: z.string().uuid(),
});

export const sessionRoutes = new Hono<AppEnv>();

sessionRoutes.use("/*", authMiddleware);

sessionRoutes.get("/list", async (c) => {
  const db = c.var.db;
  const cursor = c.req.query("cursor");
  const limit = Number(c.req.query("limit") || "20");

  const result = await findSessionsByUser(db, c.var.userId, cursor, limit);
  return c.json(result);
});

sessionRoutes.post("/create", async (c) => {
  const db = c.var.db;
  const body = createSessionSchema.parse(await c.req.json());

  const session = await insertSession(db, {
    userId: c.var.userId,
    title: body.title,
    modelTier: body.modelTier,
    systemPrompt: body.systemPrompt,
  });

  return c.json({ session }, 201);
});

sessionRoutes.get("/:id/detail", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  return c.json({ session });
});

sessionRoutes.post("/:id/update", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const body = updateSessionSchema.parse(await c.req.json());
  const updated = await updateSession(db, session.id, body);

  return c.json({ session: updated });
});

sessionRoutes.post("/:id/delete", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  await deleteSession(db, session.id);
  return c.json({ success: true });
});

sessionRoutes.post("/:id/fork", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const body = forkSessionSchema.parse(await c.req.json());
  const newSession = await forkSession(db, session.id, body.afterMessageId);

  return c.json({ session: newSession }, 201);
});
