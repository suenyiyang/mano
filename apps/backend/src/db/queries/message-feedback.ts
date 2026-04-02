import { and, eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { messageFeedback } from "../schema.js";

export const findFeedbackBySession = async (db: Db, sessionId: string, userId: string) => {
  return db
    .select({ responseId: messageFeedback.responseId, feedback: messageFeedback.feedback })
    .from(messageFeedback)
    .where(and(eq(messageFeedback.sessionId, sessionId), eq(messageFeedback.userId, userId)));
};

export const upsertFeedback = async (
  db: Db,
  input: { userId: string; sessionId: string; responseId: string; feedback: string },
) => {
  const [row] = await db
    .insert(messageFeedback)
    .values(input)
    .onConflictDoUpdate({
      target: [messageFeedback.userId, messageFeedback.responseId],
      set: { feedback: input.feedback, updatedAt: new Date() },
    })
    .returning();
  return row;
};

export const deleteFeedback = async (db: Db, userId: string, responseId: string) => {
  await db
    .delete(messageFeedback)
    .where(and(eq(messageFeedback.userId, userId), eq(messageFeedback.responseId, responseId)));
};
