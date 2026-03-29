import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../index.js";
import { activeGenerations } from "../schema.js";

export const insertActiveGeneration = async (
  db: Db,
  input: { responseId: string; sessionId: string },
) => {
  const rows = await db.insert(activeGenerations).values(input).returning();
  return rows[0]!;
};

export const findActiveGeneration = async (db: Db, sessionId: string) => {
  const rows = await db
    .select()
    .from(activeGenerations)
    .where(and(eq(activeGenerations.sessionId, sessionId), eq(activeGenerations.status, "running")))
    .limit(1);
  return rows[0] ?? null;
};

/**
 * Atomically acquire a session-level advisory lock, check for existing active
 * generation, and insert a new one. Returns the new generation row if
 * successful, or null if another generation is already running.
 *
 * Uses pg_advisory_xact_lock to prevent race conditions when two tabs try to
 * start a generation simultaneously. The lock is session-scoped (to the DB
 * transaction, not the chat session) and released when the transaction commits.
 */
export const acquireGenerationLock = async (
  db: Db,
  input: { responseId: string; sessionId: string },
) => {
  // Convert UUID to a numeric hash for pg_advisory_xact_lock
  // Use hashtext() which returns a 32-bit integer from a text input
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.sessionId}))`);

    const existing = await tx
      .select()
      .from(activeGenerations)
      .where(
        and(
          eq(activeGenerations.sessionId, input.sessionId),
          eq(activeGenerations.status, "running"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return null;
    }

    const rows = await tx.insert(activeGenerations).values(input).returning();
    return rows[0] as (typeof rows)[0];
  });

  return result;
};

export const findGenerationByResponseId = async (db: Db, responseId: string) => {
  const rows = await db
    .select()
    .from(activeGenerations)
    .where(eq(activeGenerations.responseId, responseId))
    .limit(1);
  return rows[0] ?? null;
};

export const updateGenerationStatus = async (db: Db, responseId: string, status: string) => {
  await db
    .update(activeGenerations)
    .set({ status, completedAt: new Date() })
    .where(eq(activeGenerations.responseId, responseId));
};
