import { Hono } from "hono";
import type Stripe from "stripe";
import type { AppEnv } from "../app.js";
import { updateAuthSessionsTier } from "../db/queries/auth-sessions.js";
import { grantCredits } from "../db/queries/credits.js";
import {
  insertPaymentRecord,
  updateSubscriptionStatus,
  upsertSubscription,
} from "../db/queries/subscriptions.js";
import { findUserByStripeCustomerId, updateUserTier } from "../db/queries/users.js";
import { getEnv } from "../env.js";
import { getStripe, PRICE_TIER_MAP } from "../lib/stripe.js";

/**
 * Extract current period start/end from a subscription's first item.
 * In Stripe v2025+ API, period fields moved from Subscription to SubscriptionItem.
 */
const getSubPeriod = (sub: Stripe.Subscription) => {
  const item = sub.items.data[0];
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  };
};

export const webhookRoutes = new Hono<AppEnv>();

webhookRoutes.post("/stripe", async (c) => {
  const stripe = getStripe();
  const webhookSecret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  let event: Stripe.Event;
  try {
    const rawBody = await c.req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  const db = c.var.db;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;
      if (!userId || !tier) break;

      const stripeCustomerId = session.customer as string;
      const stripeSubscriptionId = session.subscription as string;

      // Retrieve subscription to get price and period details
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const priceId = sub.items.data[0]?.price
        ? typeof sub.items.data[0].price === "string"
          ? sub.items.data[0].price
          : sub.items.data[0].price.id
        : "";
      const period = getSubPeriod(sub);

      await upsertSubscription(db, {
        userId,
        stripeCustomerId,
        stripeSubscriptionId,
        stripePriceId: priceId,
        tier,
        status: sub.status,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      });

      // Update user tier and auth sessions
      await updateUserTier(db, userId, tier);
      await updateAuthSessionsTier(db, userId, tier);

      // Grant credits for the new billing period
      await grantCredits(db, {
        userId,
        tier,
        periodStart: period.start,
        periodEnd: period.end,
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const firstItem = sub.items.data[0];
      const priceId = firstItem?.price
        ? typeof firstItem.price === "string"
          ? firstItem.price
          : firstItem.price.id
        : "";
      const priceTierMap = PRICE_TIER_MAP();
      const tier = priceTierMap[priceId] ?? "free";
      const period = getSubPeriod(sub);

      await updateSubscriptionStatus(db, sub.id, {
        status: sub.status,
        tier,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      });

      // Find user and update tier
      const customerId = sub.customer as string;
      const user = await findUserByStripeCustomerId(db, customerId);
      if (user) {
        const effectiveTier = sub.status === "active" ? tier : "free";
        await updateUserTier(db, user.id, effectiveTier);
        await updateAuthSessionsTier(db, user.id, effectiveTier);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;

      await updateSubscriptionStatus(db, sub.id, {
        status: "canceled",
        tier: "free",
      });

      const customerId = sub.customer as string;
      const user = await findUserByStripeCustomerId(db, customerId);
      if (user) {
        await updateUserTier(db, user.id, "free");
        await updateAuthSessionsTier(db, user.id, "free");
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const user = await findUserByStripeCustomerId(db, customerId);
      if (!user) break;

      // Get subscription from invoice's parent subscription details
      const subDetails = invoice.parent?.subscription_details;
      const subId =
        subDetails && typeof subDetails.subscription === "string"
          ? subDetails.subscription
          : typeof subDetails?.subscription === "object"
            ? subDetails.subscription.id
            : null;
      if (!subId) break;

      // Record payment
      const firstLine = invoice.lines.data[0];
      const linePrice = firstLine?.pricing?.price_details?.price;
      const priceId = linePrice ? (typeof linePrice === "string" ? linePrice : linePrice.id) : "";
      const priceTierMap = PRICE_TIER_MAP();
      const tier = priceTierMap[priceId] ?? user.tier;

      await insertPaymentRecord(db, {
        userId: user.id,
        stripeInvoiceId: invoice.id,
        amountCents: invoice.amount_paid,
        currency: invoice.currency,
        status: "paid",
        tier,
        paidAt: new Date((invoice.status_transitions?.paid_at ?? 0) * 1000),
      });

      // On renewal, grant fresh credits
      const sub = await stripe.subscriptions.retrieve(subId);
      const period = getSubPeriod(sub);
      await grantCredits(db, {
        userId: user.id,
        tier,
        periodStart: period.start,
        periodEnd: period.end,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subDetails = invoice.parent?.subscription_details;
      const subId =
        subDetails && typeof subDetails.subscription === "string"
          ? subDetails.subscription
          : typeof subDetails?.subscription === "object"
            ? subDetails.subscription.id
            : null;
      if (subId) {
        await updateSubscriptionStatus(db, subId, { status: "past_due" });
      }
      break;
    }
  }

  return c.json({ received: true });
});
