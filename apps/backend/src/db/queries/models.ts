import { and, eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { modelTiers, tierRateLimits } from "../schema.js";

export const findEnabledModelsByTier = async (db: Db, tier: string) => {
  return db
    .select()
    .from(modelTiers)
    .where(and(eq(modelTiers.tier, tier), eq(modelTiers.isEnabled, true)));
};

export const findAllTiersWithModels = async (db: Db) => {
  const models = await db.select().from(modelTiers).where(eq(modelTiers.isEnabled, true));
  const limits = await db.select().from(tierRateLimits);

  const limitsMap = new Map(limits.map((l) => [l.tier, l]));

  const tierMap = new Map<
    string,
    {
      tier: string;
      models: typeof models;
      rateLimit: (typeof limits)[number] | null;
    }
  >();

  for (const model of models) {
    if (!tierMap.has(model.tier)) {
      tierMap.set(model.tier, {
        tier: model.tier,
        models: [],
        rateLimit: limitsMap.get(model.tier) ?? null,
      });
    }
    tierMap.get(model.tier)!.models.push(model);
  }

  return Array.from(tierMap.values());
};
