import { eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { paymentHistory, subscriptions } from "../schema.js";

export const findSubscriptionByUserId = async (db: Db, userId: string) => {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
};

export const findSubscriptionByStripeCustomerId = async (db: Db, stripeCustomerId: string) => {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
};

export const findSubscriptionByStripeSubId = async (db: Db, stripeSubscriptionId: string) => {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
};

export const upsertSubscription = async (
  db: Db,
  input: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    tier: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd?: boolean;
  },
) => {
  const rows = await db
    .insert(subscriptions)
    .values({
      ...input,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId,
        tier: input.tier,
        status: input.status,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        updatedAt: new Date(),
      },
    })
    .returning();
  return rows[0]!;
};

export const updateSubscriptionStatus = async (
  db: Db,
  stripeSubscriptionId: string,
  updates: {
    status?: string;
    tier?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  },
) => {
  const rows = await db
    .update(subscriptions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .returning();
  return rows[0] ?? null;
};

export const insertPaymentRecord = async (
  db: Db,
  input: {
    userId: string;
    stripeInvoiceId: string;
    amountCents: number;
    currency: string;
    status: string;
    tier: string;
    paidAt: Date;
  },
) => {
  const rows = await db
    .insert(paymentHistory)
    .values(input)
    .onConflictDoNothing({ target: paymentHistory.stripeInvoiceId })
    .returning();
  return rows[0] ?? null;
};
