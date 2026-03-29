import { and, eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { modelTiers } from "../schema.js";

export const findEnabledModelsByTier = async (db: Db, tier: string) => {
  return db
    .select()
    .from(modelTiers)
    .where(and(eq(modelTiers.tier, tier), eq(modelTiers.isEnabled, true)));
};
