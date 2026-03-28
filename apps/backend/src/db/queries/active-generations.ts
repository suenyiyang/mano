import { and, eq } from "drizzle-orm";
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
