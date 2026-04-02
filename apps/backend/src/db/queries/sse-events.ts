import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../index.js";
import { sseEvents } from "../schema.js";

export const insertSseEvent = async (
  db: Db,
  input: {
    responseId: string;
    sessionId: string;
    eventType: string;
    data: unknown;
  },
) => {
  const rows = await db.insert(sseEvents).values(input).returning();
  return rows[0]!;
};

export const deleteSseEventsByResponseId = async (db: Db, responseId: string) => {
  await db.delete(sseEvents).where(eq(sseEvents.responseId, responseId));
};

export const findEventsAfter = async (db: Db, responseId: string, afterId?: number) => {
  const conditions = [eq(sseEvents.responseId, responseId)];
  if (afterId !== undefined) {
    conditions.push(gt(sseEvents.id, afterId));
  }

  return db
    .select()
    .from(sseEvents)
    .where(and(...conditions))
    .orderBy(sseEvents.id);
};
