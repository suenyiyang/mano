import type { MiddlewareHandler } from "hono";
import {
  findTierRateLimits,
  getDailyUsage,
  getMinuteRequestCount,
  incrementDailyUsage,
  logMinuteRequest,
} from "../db/queries/rate-limits.js";
import { HttpError } from "./error-handler.js";

/**
 * Rate limit middleware for chat endpoints.
 * Checks per-minute and per-day request limits based on user's tier.
 * Should be applied AFTER authMiddleware (needs userId and userTier).
 */
export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const db = c.var.db;
  const userId = c.get("userId") as string;
  const userTier = c.get("userTier") as string;

  const limits = await findTierRateLimits(db, userTier);
  if (!limits) {
    // No rate limits configured for this tier — allow through
    await next();
    return;
  }

  // Check per-minute limit
  const minuteCount = await getMinuteRequestCount(db, userId);
  if (minuteCount >= limits.requestsPerMinute) {
    throw new HttpError(429, "Rate limit exceeded: too many requests per minute");
  }

  // Check per-day limits
  const dailyUsage = await getDailyUsage(db, userId);
  if (dailyUsage) {
    if (dailyUsage.requestsUsed >= limits.requestsPerDay) {
      throw new HttpError(429, "Rate limit exceeded: daily request limit reached");
    }
    if (dailyUsage.tokensUsed >= limits.tokensPerDay) {
      throw new HttpError(429, "Rate limit exceeded: daily token limit reached");
    }
  }

  // Log this request
  await logMinuteRequest(db, userId);
  await incrementDailyUsage(db, userId);

  await next();
};
