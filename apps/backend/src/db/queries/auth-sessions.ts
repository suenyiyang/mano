import crypto from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Db } from "../index.js";
import { authSessions } from "../schema.js";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const createAuthSession = async (
  db: Db,
  { userId, userTier }: { userId: string; userTier: string },
) => {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  const [session] = await db
    .insert(authSessions)
    .values({ id, userId, userTier, expiresAt })
    .returning();
  return session;
};

export const findAuthSession = async (db: Db, sessionId: string) => {
  const [session] = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.id, sessionId))
    .limit(1);
  return session ?? null;
};

export const deleteAuthSession = async (db: Db, sessionId: string) => {
  await db.delete(authSessions).where(eq(authSessions.id, sessionId));
};

export const deleteUserAuthSessions = async (db: Db, userId: string) => {
  await db.delete(authSessions).where(eq(authSessions.userId, userId));
};

export const extendAuthSession = async (db: Db, sessionId: string, newExpiresAt: Date) => {
  await db
    .update(authSessions)
    .set({ expiresAt: newExpiresAt })
    .where(eq(authSessions.id, sessionId));
};

export const deleteExpiredAuthSessions = async (db: Db) => {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
};
