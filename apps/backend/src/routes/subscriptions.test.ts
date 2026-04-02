// @ts-nocheck — test file with mocked responses
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app.js";

const TEST_USER_ID = "user-1";
const TEST_USER = {
  id: TEST_USER_ID,
  email: "test@example.com",
  displayName: "Test User",
  tier: "free",
  stripeCustomerId: null,
};

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
      c.set("userId", TEST_USER_ID);
      c.set("userTier", "free");
      await next();
    },
  ),
}));

vi.mock("../db/queries/credits.js", () => ({
  TIER_CREDITS: { free: 1000, pro: 20000, max: 100000 },
  findCreditBalance: vi.fn(async () => ({
    balance: 800,
    monthlyAllowance: 1000,
    periodEnd: new Date().toISOString(),
  })),
  findCreditTransactions: vi.fn(async () => []),
}));

vi.mock("../db/queries/model-tiers.js", () => ({
  findEnabledModelsByTier: vi.fn(async (_db: unknown, tier: string) => {
    if (tier === "free") {
      return [
        {
          tier: "free",
          provider: "volcengine",
          apiModelId: "doubao-seed-2-0-pro",
          displayName: "Doubao",
          weight: 1,
          isEnabled: true,
          config: {},
        },
      ];
    }
    return [];
  }),
}));

vi.mock("../db/queries/subscriptions.js", () => ({
  findSubscriptionByUserId: vi.fn(async () => null),
}));

vi.mock("../db/queries/users.js", () => ({
  findUserById: vi.fn(async () => TEST_USER),
  updateUserStripeCustomerId: vi.fn(async () => TEST_USER),
}));

vi.mock("../env.js", () => ({
  getEnv: () => ({
    FRONTEND_URL: "http://localhost:5173",
    STRIPE_SECRET_KEY: "sk_test_xxx",
    STRIPE_PRO_PRICE_ID: "price_pro",
    STRIPE_MAX_PRICE_ID: "price_max",
  }),
}));

vi.mock("../lib/stripe.js", () => ({
  getStripe: () => ({
    customers: {
      create: vi.fn(async () => ({ id: "cus_test" })),
    },
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          url: "https://checkout.stripe.com/test",
        })),
      },
    },
  }),
  TIER_PRICE_MAP: {
    pro: () => "price_pro",
    max: () => "price_max",
  },
}));

const mockDb = {};

const { subscriptionRoutes } = await import("./subscriptions.js");

const app = new Hono<AppEnv>();
app.use("/*", async (c, next) => {
  c.set("db", mockDb as never);
  await next();
});
app.route("/api/subscriptions", subscriptionRoutes);

describe("GET /api/subscriptions/plans", () => {
  it("returns plan list", async () => {
    const res = await app.request("/api/subscriptions/plans");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.plans).toHaveLength(3);
    expect(body.plans[0].tier).toBe("free");
    expect(body.plans[0].creditAllowance).toBe(1000);
    expect(body.plans[1].tier).toBe("pro");
    expect(body.plans[1].priceMonthly).toBe(20);
    expect(body.plans[2].tier).toBe("max");
    expect(body.plans[2].priceMonthly).toBe(100);
  });
});

describe("GET /api/subscriptions/current", () => {
  it("returns current subscription status and credits", async () => {
    const res = await app.request("/api/subscriptions/current");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tier).toBe("free");
    expect(body.credits.balance).toBe(800);
    expect(body.credits.monthlyAllowance).toBe(1000);
    expect(body.subscription).toBeNull();
  });
});

describe("POST /api/subscriptions/checkout", () => {
  it("creates checkout session for pro tier", async () => {
    const res = await app.request("/api/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "pro" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.com/test");
  });

  it("rejects invalid tier", async () => {
    const res = await app.request("/api/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "invalid" }),
    });
    // Zod validation throws — without errorHandler middleware it's a 500
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
