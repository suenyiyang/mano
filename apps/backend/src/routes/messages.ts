import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import {
  deleteFeedback,
  findFeedbackBySession,
  upsertFeedback,
} from "../db/queries/message-feedback.js";
import { findMessagesBySession } from "../db/queries/messages.js";
import { findSessionById } from "../db/queries/sessions.js";
import { authMiddleware } from "../middleware/auth.js";
import { forbidden, notFound } from "../middleware/error-handler.js";

export const messageRoutes = new Hono<AppEnv>();

messageRoutes.use("/*", authMiddleware);

messageRoutes.get("/:id/messages/list", async (c) => {
  const db = c.var.db;
  const userId = c.var.userId;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== userId) {
    throw forbidden();
  }

  const cursorParam = c.req.query("cursor");
  const cursor = cursorParam ? Number(cursorParam) : undefined;
  const limit = Number(c.req.query("limit") || "50");

  const [result, feedbackRows] = await Promise.all([
    findMessagesBySession(db, session.id, cursor, limit),
    cursor === undefined ? findFeedbackBySession(db, session.id, userId) : Promise.resolve([]),
  ]);

  const feedbackMap: Record<string, string> = {};
  for (const row of feedbackRows) {
    feedbackMap[row.responseId] = row.feedback;
  }

  return c.json({ ...result, feedbackMap });
});

messageRoutes.post("/:id/feedback", async (c) => {
  const db = c.var.db;
  const userId = c.var.userId;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== userId) {
    throw forbidden();
  }

  const body = await c.req.json<{ responseId: string; feedback: "like" | "dislike" | null }>();

  if (body.feedback === null) {
    await deleteFeedback(db, userId, body.responseId);
  } else {
    await upsertFeedback(db, {
      userId,
      sessionId: session.id,
      responseId: body.responseId,
      feedback: body.feedback,
    });
  }

  return c.json({ success: true });
});
