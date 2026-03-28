import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { findMessagesBySession } from "../db/queries/messages.js";
import { findSessionById } from "../db/queries/sessions.js";
import { authMiddleware } from "../middleware/auth.js";
import { forbidden, notFound } from "../middleware/error-handler.js";

export const messageRoutes = new Hono<AppEnv>();

messageRoutes.use("/*", authMiddleware);

messageRoutes.get("/:id/messages/list", async (c) => {
  const db = c.var.db;
  const session = await findSessionById(db, c.req.param("id"));
  if (!session) {
    throw notFound("Session not found");
  }
  if (session.userId !== c.var.userId) {
    throw forbidden();
  }

  const cursorParam = c.req.query("cursor");
  const cursor = cursorParam ? Number(cursorParam) : undefined;
  const limit = Number(c.req.query("limit") || "50");

  const result = await findMessagesBySession(db, session.id, cursor, limit);
  return c.json(result);
});
