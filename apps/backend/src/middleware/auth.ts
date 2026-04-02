import type { MiddlewareHandler } from "hono";
import {
  deleteAuthSession,
  extendAuthSession,
  findAuthSession,
} from "../db/queries/auth-sessions.js";
import { getSessionCookie } from "../lib/session.js";
import { unauthorized } from "./error-handler.js";

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const sessionId = getSessionCookie(c);
  if (!sessionId) {
    throw unauthorized("Missing session");
  }

  const db = c.var.db;
  const session = await findAuthSession(db, sessionId);
  if (!session) {
    throw unauthorized("Invalid session");
  }

  if (session.expiresAt < new Date()) {
    await deleteAuthSession(db, sessionId);
    throw unauthorized("Session expired");
  }

  c.set("userId", session.userId);

  // Sliding window: extend if less than 15 days remaining
  const remainingMs = session.expiresAt.getTime() - Date.now();
  if (remainingMs < FIFTEEN_DAYS_MS) {
    const newExpiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
    await extendAuthSession(db, sessionId, newExpiresAt);
  }

  await next();
};
