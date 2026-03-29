import { and, eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { skills } from "../schema.js";

export const findSkillsByUser = async (db: Db, userId: string) => {
  return db.select().from(skills).where(eq(skills.userId, userId));
};

export const findEnabledSkillsByUser = async (db: Db, userId: string) => {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.isEnabled, true)));
};

export const findSkillById = async (db: Db, id: string) => {
  const rows = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
  return rows[0] ?? null;
};

export const findSkillByName = async (db: Db, userId: string, name: string) => {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.name, name)))
    .limit(1);
  return rows[0] ?? null;
};

export const insertSkill = async (
  db: Db,
  input: {
    userId: string;
    name: string;
    displayName: string;
    description?: string;
    content: string;
    resources?: unknown;
    scripts?: unknown;
  },
) => {
  const rows = await db
    .insert(skills)
    .values({
      userId: input.userId,
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? "",
      content: input.content,
      resources: input.resources ?? [],
      scripts: input.scripts ?? [],
    })
    .returning();
  return rows[0]!;
};

export const updateSkill = async (
  db: Db,
  id: string,
  input: {
    name?: string;
    displayName?: string;
    description?: string;
    content?: string;
    resources?: unknown;
    scripts?: unknown;
    isEnabled?: boolean;
  },
) => {
  const rows = await db
    .update(skills)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(skills.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteSkill = async (db: Db, id: string) => {
  await db.delete(skills).where(eq(skills.id, id));
};
