import { and, eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { skills } from "../schema.js";

export const findEnabledSkillsByUser = async (db: Db, userId: string) => {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.isEnabled, true)));
};

export const findSkillByName = async (db: Db, userId: string, name: string) => {
  const rows = await db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), eq(skills.name, name)))
    .limit(1);
  return rows[0] ?? null;
};
