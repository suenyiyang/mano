import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { findCreditBalance, findCreditTransactions, TIER_CREDITS } from "../db/queries/credits.js";
import { findEnabledModelsByTier } from "../db/queries/model-tiers.js";
import { findSubscriptionByUserId } from "../db/queries/subscriptions.js";
import { findUserById, updateUserStripeCustomerId } from "../db/queries/users.js";
import { getEnv } from "../env.js";
import { getStripe, TIER_PRICE_MAP } from "../lib/stripe.js";
import { authMiddleware } from "../middleware/auth.js";
import { badRequest } from "../middleware/error-handler.js";

const checkoutSchema = z.object({
  tier: z.enum(["pro", "max"]),
});

export const subscriptionRoutes = new Hono<AppEnv>();

subscriptionRoutes.use("/*", authMiddleware);

// Get available plans with models
subscriptionRoutes.get("/plans", async (c) => {
  const db = c.var.db;

  const [freeModels, proModels, maxModels] = await Promise.all([
    findEnabledModelsByTier(db, "free"),
    findEnabledModelsByTier(db, "pro"),
    findEnabledModelsByTier(db, "max"),
  ]);

  const plans = [
    {
      tier: "free",
      name: "Free",
      priceMonthly: 0,
      creditAllowance: TIER_CREDITS.free,
      models: freeModels.map((m) => ({
        provider: m.provider,
        apiModelId: m.apiModelId,
        displayName: m.displayName,
      })),
    },
    {
      tier: "pro",
      name: "Pro",
      priceMonthly: 20,
      creditAllowance: TIER_CREDITS.pro,
      models: proModels.map((m) => ({
        provider: m.provider,
        apiModelId: m.apiModelId,
        displayName: m.displayName,
      })),
    },
    {
      tier: "max",
      name: "Max",
      priceMonthly: 100,
      creditAllowance: TIER_CREDITS.max,
      models: maxModels.map((m) => ({
        provider: m.provider,
        apiModelId: m.apiModelId,
        displayName: m.displayName,
      })),
    },
  ];

  return c.json({ plans });
});

// Get current subscription status + credit balance
subscriptionRoutes.get("/current", async (c) => {
  const db = c.var.db;
  const userId = c.var.userId;

  const [subscription, creditBalance, recentTransactions] = await Promise.all([
    findSubscriptionByUserId(db, userId),
    findCreditBalance(db, userId),
    findCreditTransactions(db, userId, { limit: 20 }),
  ]);

  const user = await findUserById(db, userId);

  return c.json({
    tier: user?.tier ?? "free",
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    credits: creditBalance
      ? {
          balance: creditBalance.balance,
          monthlyAllowance: creditBalance.monthlyAllowance,
          periodEnd: creditBalance.periodEnd,
        }
      : {
          balance: 0,
          monthlyAllowance: TIER_CREDITS[user?.tier ?? "free"],
          periodEnd: null,
        },
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      modelId: t.modelId,
      createdAt: t.createdAt,
    })),
  });
});

// Create Stripe Checkout session
subscriptionRoutes.post("/checkout", async (c) => {
  const db = c.var.db;
  const userId = c.var.userId;
  const body = checkoutSchema.parse(await c.req.json());

  const priceIdGetter = TIER_PRICE_MAP[body.tier];
  const priceId = priceIdGetter?.();
  if (!priceId) {
    throw badRequest(`No Stripe price configured for tier: ${body.tier}`);
  }

  const stripe = getStripe();
  const user = await findUserById(db, userId);
  if (!user) {
    throw badRequest("User not found");
  }

  // Get or create Stripe customer
  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    stripeCustomerId = customer.id;
    await updateUserStripeCustomerId(db, userId, stripeCustomerId);
  }

  const frontendUrl = getEnv().FRONTEND_URL;

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl}/app/settings?tab=subscription&success=true`,
    cancel_url: `${frontendUrl}/app/settings?tab=subscription`,
    metadata: { userId: user.id, tier: body.tier },
  });

  return c.json({ url: session.url });
});

// Create Stripe Customer Portal session
subscriptionRoutes.post("/portal", async (c) => {
  const db = c.var.db;
  const userId = c.var.userId;

  const user = await findUserById(db, userId);
  if (!user?.stripeCustomerId) {
    throw badRequest("No billing account found");
  }

  const stripe = getStripe();
  const frontendUrl = getEnv().FRONTEND_URL;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${frontendUrl}/app/settings?tab=subscription`,
  });

  return c.json({ url: portalSession.url });
});
