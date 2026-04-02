import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import type { Db } from "../index.js";
import { messages } from "../schema.js";

export const findMessagesBySession = async (
  db: Db,
  sessionId: string,
  cursor?: number,
  limit = 50,
) => {
  const conditions = [eq(messages.sessionId, sessionId)];
  if (cursor !== undefined) {
    conditions.push(lt(messages.ordinal, cursor));
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.ordinal))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]!.ordinal : null;

  // Return in ascending order
  return { messages: items.reverse(), nextCursor };
};

export const findAllMessagesBySession = async (db: Db, sessionId: string) => {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.ordinal);
};

export const findMessagesAfterOrdinal = async (db: Db, sessionId: string, ordinal: number) => {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), gt(messages.ordinal, ordinal)))
    .orderBy(messages.ordinal);
};

export const getNextOrdinal = async (db: Db, sessionId: string) => {
  const result = await db
    .select({ maxOrdinal: sql<number>`coalesce(max(${messages.ordinal}), -1)` })
    .from(messages)
    .where(eq(messages.sessionId, sessionId));
  return (result[0]?.maxOrdinal ?? -1) + 1;
};

export const insertMessage = async (
  db: Db,
  input: {
    sessionId: string;
    role: string;
    content: unknown;
    toolCalls?: unknown;
    toolCallId?: string;
    toolName?: string;
    ordinal: number;
    modelId?: string;
    responseId?: string;
    tokenUsage?: unknown;
  },
) => {
  const rows = await db.insert(messages).values(input).returning();
  return rows[0]!;
};

export const deleteNonUserMessagesByResponseId = async (db: Db, responseId: string) => {
  await db
    .delete(messages)
    .where(and(eq(messages.responseId, responseId), ne(messages.role, "user")));
};

export const markMessagesCompacted = async (db: Db, sessionId: string, upToOrdinal: number) => {
  await db
    .update(messages)
    .set({ isCompacted: true })
    .where(and(eq(messages.sessionId, sessionId), lt(messages.ordinal, upToOrdinal + 1)));
};
