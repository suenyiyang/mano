import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { findAllMessagesBySession, markMessagesCompacted } from "../db/queries/messages.js";
import {
  deleteSession,
  findSessionById,
  findSessionsByUser,
  forkSession,
  insertSession,
  updateSession,
  updateSessionCompaction,
} from "../db/queries/sessions.js";
import { authMiddleware } from "../middleware/auth.js";
import { badRequest, forbidden, notFound } from "../middleware/error-handler.js";

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

const compactSessionSchema = z.object({
  upToOrdinal: z.number().int().min(0),
  summary: z.string().min(1),
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

sessionRoutes.post("/:id/compact", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const body = compactSessionSchema.parse(await c.req.json());

  // Verify there are messages to compact
  const allMessages = await findAllMessagesBySession(db, session.id);
  const messagesToCompact = allMessages.filter((m) => m.ordinal <= body.upToOrdinal);
  if (messagesToCompact.length === 0) {
    throw badRequest("No messages to compact at this ordinal");
  }

  const lastCompactedMessage = messagesToCompact[messagesToCompact.length - 1]!;

  // Mark messages as compacted and update session
  await markMessagesCompacted(db, session.id, body.upToOrdinal);
  const updated = await updateSessionCompaction(
    db,
    session.id,
    body.summary,
    lastCompactedMessage.id,
  );

  return c.json({ session: updated });
});
