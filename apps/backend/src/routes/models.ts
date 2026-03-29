import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { findAllTiersWithModels } from "../db/queries/models.js";
import { authMiddleware } from "../middleware/auth.js";

export const modelRoutes = new Hono<AppEnv>();

modelRoutes.use("/*", authMiddleware);

modelRoutes.get("/tiers", async (c) => {
  const db = c.var.db;
  const tiers = await findAllTiersWithModels(db);

  return c.json({
    tiers: tiers.map((t) => ({
      tier: t.tier,
      models: t.models.map((m) => ({
        provider: m.provider,
        apiModelId: m.apiModelId,
        displayName: m.displayName,
      })),
      rateLimit: t.rateLimit
        ? {
            requestsPerMinute: t.rateLimit.requestsPerMinute,
            requestsPerDay: t.rateLimit.requestsPerDay,
            tokensPerDay: t.rateLimit.tokensPerDay,
          }
        : null,
    })),
  });
});
