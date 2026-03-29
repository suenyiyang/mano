import { and, eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { mcpServers } from "../schema.js";

export const findMcpServersByUser = async (db: Db, userId: string) => {
  return db.select().from(mcpServers).where(eq(mcpServers.userId, userId));
};

export const findMcpServerById = async (db: Db, id: string) => {
  const rows = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1);
  return rows[0] ?? null;
};

export const findEnabledMcpServersByUser = async (db: Db, userId: string) => {
  return db
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.userId, userId), eq(mcpServers.isEnabled, true)));
};

export const insertMcpServer = async (
  db: Db,
  input: {
    userId: string;
    name: string;
    transport: string;
    command?: string;
    args?: unknown;
    url?: string;
    env?: unknown;
  },
) => {
  const rows = await db
    .insert(mcpServers)
    .values({
      userId: input.userId,
      name: input.name,
      transport: input.transport,
      command: input.command,
      args: input.args,
      url: input.url,
      env: input.env,
    })
    .returning();
  return rows[0]!;
};

export const updateMcpServer = async (
  db: Db,
  id: string,
  input: {
    name?: string;
    transport?: string;
    command?: string;
    args?: unknown;
    url?: string;
    env?: unknown;
    isEnabled?: boolean;
  },
) => {
  const rows = await db
    .update(mcpServers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(mcpServers.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteMcpServer = async (db: Db, id: string) => {
  await db.delete(mcpServers).where(eq(mcpServers.id, id));
};
