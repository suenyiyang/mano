import { and, desc, eq, lt } from "drizzle-orm";
import type { Db } from "../index.js";
import { messages, sessions } from "../schema.js";

export const findSessionsByUser = async (db: Db, userId: string, cursor?: string, limit = 20) => {
  const conditions = [eq(sessions.userId, userId)];
  if (cursor) {
    conditions.push(lt(sessions.updatedAt, new Date(cursor)));
  }

  const rows = await db
    .select()
    .from(sessions)
    .where(and(...conditions))
    .orderBy(desc(sessions.updatedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]!.updatedAt.toISOString() : null;

  return { sessions: items, nextCursor };
};

export const findSessionById = async (db: Db, id: string) => {
  const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return rows[0] ?? null;
};

export const insertSession = async (
  db: Db,
  input: {
    userId: string;
    title?: string;
    systemPrompt?: string;
    modelTier?: string;
    forkedFromSessionId?: string;
    forkedAtMessageId?: string;
  },
) => {
  const rows = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      title: input.title,
      systemPrompt: input.systemPrompt ?? "",
      modelTier: input.modelTier ?? "pro",
      forkedFromSessionId: input.forkedFromSessionId,
      forkedAtMessageId: input.forkedAtMessageId,
    })
    .returning();
  return rows[0]!;
};

export const updateSession = async (
  db: Db,
  id: string,
  input: {
    title?: string;
    systemPrompt?: string;
    modelTier?: string;
    compactSummary?: string;
    compactAfterMessageId?: string;
  },
) => {
  const rows = await db
    .update(sessions)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(sessions.id, id))
    .returning();
  return rows[0] ?? null;
};

export const updateSessionCompaction = async (
  db: Db,
  id: string,
  compactSummary: string,
  compactAfterMessageId: string,
) => {
  const rows = await db
    .update(sessions)
    .set({ compactSummary, compactAfterMessageId, updatedAt: new Date() })
    .where(eq(sessions.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteSession = async (db: Db, id: string) => {
  await db.delete(sessions).where(eq(sessions.id, id));
};

export const forkSession = async (db: Db, sessionId: string, afterMessageId: string) => {
  return db.transaction(async (tx) => {
    const original = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!original[0]) {
      throw new Error("Session not found");
    }

    const forkMessage = await tx
      .select()
      .from(messages)
      .where(eq(messages.id, afterMessageId))
      .limit(1);
    if (!forkMessage[0]) {
      throw new Error("Message not found");
    }

    const newSession = await tx
      .insert(sessions)
      .values({
        userId: original[0].userId,
        title: original[0].title ? `${original[0].title} (fork)` : null,
        systemPrompt: original[0].systemPrompt,
        modelTier: original[0].modelTier,
        forkedFromSessionId: sessionId,
        forkedAtMessageId: afterMessageId,
      })
      .returning();

    // Copy messages up to and including the fork point
    const messagesToCopy = await tx
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.sessionId, sessionId),
          // ordinal <= fork message ordinal
        ),
      )
      .orderBy(messages.ordinal);

    const forkOrdinal = forkMessage[0].ordinal;
    const filtered = messagesToCopy.filter((m) => m.ordinal <= forkOrdinal);

    if (filtered.length > 0) {
      await tx.insert(messages).values(
        filtered.map((m) => ({
          sessionId: newSession[0]!.id,
          role: m.role,
          content: m.content,
          toolCalls: m.toolCalls,
          toolCallId: m.toolCallId,
          toolName: m.toolName,
          ordinal: m.ordinal,
          modelId: m.modelId,
          responseId: m.responseId,
          tokenUsage: m.tokenUsage,
          isCompacted: m.isCompacted,
        })),
      );
    }

    return newSession[0]!;
  });
};
