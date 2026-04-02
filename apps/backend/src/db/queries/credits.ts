import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "../index.js";
import { creditBalances, creditTransactions } from "../schema.js";

export const TIER_CREDITS: Record<string, number> = {
  free: 1_000,
  pro: 20_000,
  max: 100_000,
};

export const findCreditBalance = async (db: Db, userId: string) => {
  const rows = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);
  return rows[0] ?? null;
};

export const ensureCreditBalance = async (db: Db, userId: string, tier: string) => {
  const allowance = TIER_CREDITS[tier] ?? TIER_CREDITS.free;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const rows = await db
    .insert(creditBalances)
    .values({
      userId,
      balance: allowance,
      monthlyAllowance: allowance,
      periodStart: now,
      periodEnd,
    })
    .onConflictDoNothing({ target: creditBalances.userId })
    .returning();

  if (rows[0]) return rows[0];
  return await findCreditBalance(db, userId);
};

export const deductCredits = async (
  db: Db,
  opts: {
    userId: string;
    amount: number;
    sessionId?: string;
    modelId?: string;
    description?: string;
  },
) => {
  const { userId, amount, sessionId, modelId, description } = opts;

  // Atomically deduct and get new balance
  const updated = await db
    .update(creditBalances)
    .set({
      balance: sql`GREATEST(${creditBalances.balance} - ${amount}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(creditBalances.userId, userId))
    .returning({ balance: creditBalances.balance });

  const newBalance = updated[0]?.balance ?? 0;

  // Record transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    type: "usage",
    description,
    sessionId,
    modelId,
    balanceAfter: newBalance,
  });

  return newBalance;
};

export const grantCredits = async (
  db: Db,
  opts: {
    userId: string;
    tier: string;
    periodStart: Date;
    periodEnd: Date;
  },
) => {
  const { userId, tier, periodStart, periodEnd } = opts;
  const allowance = TIER_CREDITS[tier] ?? TIER_CREDITS.free;

  // Reset balance to monthly allowance
  const updated = await db
    .insert(creditBalances)
    .values({
      userId,
      balance: allowance,
      monthlyAllowance: allowance,
      periodStart,
      periodEnd,
    })
    .onConflictDoUpdate({
      target: creditBalances.userId,
      set: {
        balance: sql`${allowance}`,
        monthlyAllowance: allowance,
        periodStart,
        periodEnd,
        updatedAt: new Date(),
      },
    })
    .returning();

  const newBalance = updated[0]?.balance ?? allowance;

  // Record grant transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: allowance,
    type: "monthly_grant",
    description: `Monthly credit grant (${tier} plan)`,
    balanceAfter: newBalance,
  });

  return newBalance;
};

export const findCreditTransactions = async (
  db: Db,
  userId: string,
  opts: { limit?: number } = {},
) => {
  return await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(opts.limit ?? 50);
};

/**
 * Calculate the credit cost for a model invocation.
 */
export const calculateCreditCost = (
  inputTokens: number,
  outputTokens: number,
  config: { creditsPerMillionInputTokens?: number; creditsPerMillionOutputTokens?: number },
): number => {
  const inputCost = config.creditsPerMillionInputTokens ?? 1;
  const outputCost = config.creditsPerMillionOutputTokens ?? 4;
  return Math.ceil((inputTokens * inputCost + outputTokens * outputCost) / 1_000_000);
};
