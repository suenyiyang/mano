import { eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { modelTiers } from "../schema.js";

export const findEnabledModels = async (db: Db) => {
  return await db.select().from(modelTiers).where(eq(modelTiers.isEnabled, true));
};

/**
 * Select a model using weighted random selection.
 * Returns null if no models are enabled.
 */
export const selectModel = async (db: Db) => {
  const models = await findEnabledModels(db);
  if (models.length === 0) return null;

  const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;

  for (const model of models) {
    random -= model.weight;
    if (random <= 0) return model;
  }

  return models[0]!;
};
