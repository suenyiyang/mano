import { eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { attachments } from "../schema.js";

export const findAttachmentById = async (db: Db, id: string) => {
  const rows = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return rows[0] ?? null;
};

export const findAttachmentsByMessage = async (db: Db, messageId: string) => {
  return db.select().from(attachments).where(eq(attachments.messageId, messageId));
};

export const findAttachmentsByUser = async (db: Db, userId: string) => {
  return db.select().from(attachments).where(eq(attachments.userId, userId));
};

export const insertAttachment = async (
  db: Db,
  input: {
    userId: string;
    messageId?: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  },
) => {
  const rows = await db.insert(attachments).values(input).returning();
  return rows[0]!;
};

export const linkAttachmentToMessage = async (db: Db, id: string, messageId: string) => {
  const rows = await db
    .update(attachments)
    .set({ messageId })
    .where(eq(attachments.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteAttachment = async (db: Db, id: string) => {
  const rows = await db.delete(attachments).where(eq(attachments.id, id)).returning();
  return rows[0] ?? null;
};
