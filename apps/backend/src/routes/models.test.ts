// @ts-nocheck — test file with mocked responses
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app.js";

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
      c.set("userId", "test-user-id");
      c.set("userTier", "pro");
      await next();
    },
  ),
}));

vi.mock("../db/queries/models.js", () => ({
  findAllTiersWithModels: vi.fn(async () => [
    {
      tier: "mini",
      models: [
        {
          tier: "mini",
          provider: "volcengine",
          apiModelId: "doubao-lite",
          displayName: "Doubao Lite",
          weight: 1,
          isEnabled: true,
          config: {},
        },
      ],
      rateLimit: { tier: "mini", requestsPerMinute: 10, requestsPerDay: 100, tokensPerDay: 100000 },
    },
    {
      tier: "pro",
      models: [
        {
          tier: "pro",
          provider: "volcengine",
          apiModelId: "doubao-pro",
          displayName: "Doubao Pro",
          weight: 3,
          isEnabled: true,
          config: {},
        },
        {
          tier: "pro",
          provider: "openai",
          apiModelId: "gpt-4o",
          displayName: "GPT-4o",
          weight: 1,
          isEnabled: true,
          config: {},
        },
      ],
      rateLimit: { tier: "pro", requestsPerMinute: 30, requestsPerDay: 500, tokensPerDay: 1000000 },
    },
  ]),
}));

const createTestApp = async () => {
  const { modelRoutes } = await import("./models.js");
  const app = new Hono<AppEnv>();
  app.use("/*", async (c, next) => {
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/models", modelRoutes);
  return app;
};

describe("Model routes", () => {
  it("GET /tiers returns grouped tiers with models", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/models/tiers", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.tiers).toHaveLength(2);

    const mini = body.tiers.find((t: { tier: string }) => t.tier === "mini");
    expect(mini.models).toHaveLength(1);
    expect(mini.models[0].displayName).toBe("Doubao Lite");
    expect(mini.rateLimit.requestsPerMinute).toBe(10);

    const pro = body.tiers.find((t: { tier: string }) => t.tier === "pro");
    expect(pro.models).toHaveLength(2);
    expect(pro.models.map((m: { provider: string }) => m.provider)).toContain("volcengine");
    expect(pro.models.map((m: { provider: string }) => m.provider)).toContain("openai");
  });

  it("GET /tiers returns models without internal fields", async () => {
    const app = await createTestApp();
    const res = await app.request("/api/models/tiers", {
      headers: { authorization: "Bearer test" },
    });

    const body = await res.json();
    const model = body.tiers[0].models[0];

    // Should include display fields
    expect(model).toHaveProperty("provider");
    expect(model).toHaveProperty("apiModelId");
    expect(model).toHaveProperty("displayName");

    // Should not leak internal fields
    expect(model).not.toHaveProperty("weight");
    expect(model).not.toHaveProperty("isEnabled");
    expect(model).not.toHaveProperty("config");
  });

  it("GET /tiers with no tiers returns empty array", async () => {
    const { findAllTiersWithModels } = await import("../db/queries/models.js");
    vi.mocked(findAllTiersWithModels).mockResolvedValueOnce([]);

    const app = await createTestApp();
    const res = await app.request("/api/models/tiers", {
      headers: { authorization: "Bearer test" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tiers).toEqual([]);
  });
});
