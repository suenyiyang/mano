import { and, eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { modelTiers } from "../schema.js";

export const findEnabledModelsByTier = async (db: Db, tier: string) => {
  return await db
    .select()
    .from(modelTiers)
    .where(and(eq(modelTiers.tier, tier), eq(modelTiers.isEnabled, true)));
};

/**
 * Select a model for the given tier using weighted random selection.
 * Returns null if no models are enabled for the tier.
 */
export const selectModelForTier = async (db: Db, tier: string) => {
  const models = await findEnabledModelsByTier(db, tier);
  if (models.length === 0) return null;

  const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;

  for (const model of models) {
    random -= model.weight;
    if (random <= 0) return model;
  }

  return models[0]!;
};

/**
 * Find a specific model by tier, provider, and apiModelId.
 */
export const findModelByTierAndId = async (
  db: Db,
  tier: string,
  provider: string,
  apiModelId: string,
) => {
  const rows = await db
    .select()
    .from(modelTiers)
    .where(
      and(
        eq(modelTiers.tier, tier),
        eq(modelTiers.provider, provider),
        eq(modelTiers.apiModelId, apiModelId),
        eq(modelTiers.isEnabled, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
};

/**
 * Get all unique tiers that have models enabled.
 */
export const findAllTiers = async (db: Db) => {
  const rows = await db
    .select({ tier: modelTiers.tier })
    .from(modelTiers)
    .where(eq(modelTiers.isEnabled, true));

  return [...new Set(rows.map((r) => r.tier))];
};
