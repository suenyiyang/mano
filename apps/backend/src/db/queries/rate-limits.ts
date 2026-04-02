import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "../index.js";
import { rateLimitMinuteLog, rateLimitUsage } from "../schema.js";

const getToday = () => {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
};

export const getDailyUsage = async (db: Db, userId: string) => {
  const today = getToday();
  const rows = await db
    .select()
    .from(rateLimitUsage)
    .where(and(eq(rateLimitUsage.userId, userId), eq(rateLimitUsage.date, today)))
    .limit(1);
  return rows[0] ?? null;
};

export const incrementDailyUsage = async (db: Db, userId: string, additionalTokens = 0) => {
  const today = getToday();

  // Upsert: increment requests and tokens
  await db
    .insert(rateLimitUsage)
    .values({
      userId,
      date: today,
      requestsUsed: 1,
      tokensUsed: additionalTokens,
    })
    .onConflictDoUpdate({
      target: [rateLimitUsage.userId, rateLimitUsage.date],
      set: {
        requestsUsed: sql`${rateLimitUsage.requestsUsed} + 1`,
        tokensUsed: sql`${rateLimitUsage.tokensUsed} + ${additionalTokens}`,
        updatedAt: new Date(),
      },
    });
};

export const addTokensToDailyUsage = async (db: Db, userId: string, tokens: number) => {
  const today = getToday();

  await db
    .insert(rateLimitUsage)
    .values({
      userId,
      date: today,
      requestsUsed: 0,
      tokensUsed: tokens,
    })
    .onConflictDoUpdate({
      target: [rateLimitUsage.userId, rateLimitUsage.date],
      set: {
        tokensUsed: sql`${rateLimitUsage.tokensUsed} + ${tokens}`,
        updatedAt: new Date(),
      },
    });
};

export const getMinuteRequestCount = async (db: Db, userId: string) => {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(rateLimitMinuteLog)
    .where(
      and(eq(rateLimitMinuteLog.userId, userId), gt(rateLimitMinuteLog.createdAt, oneMinuteAgo)),
    );
  return rows[0]?.count ?? 0;
};

export const logMinuteRequest = async (db: Db, userId: string) => {
  await db.insert(rateLimitMinuteLog).values({ userId });
};

export const cleanupOldMinuteLogs = async (db: Db) => {
  const twoMinutesAgo = new Date(Date.now() - 120_000);
  await db.delete(rateLimitMinuteLog).where(lt(rateLimitMinuteLog.createdAt, twoMinutesAgo));
};
