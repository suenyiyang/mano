import type { MiddlewareHandler } from "hono";
import { ensureCreditBalance } from "../db/queries/credits.js";
import {
  findTierRateLimits,
  getMinuteRequestCount,
  logMinuteRequest,
} from "../db/queries/rate-limits.js";
import { HttpError } from "./error-handler.js";

/**
 * Rate limit middleware for chat endpoints.
 * Checks per-minute request limit and credit balance.
 * Should be applied AFTER authMiddleware (needs userId and userTier).
 */
export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const db = c.var.db;
  const userId = c.get("userId") as string;
  const userTier = c.get("userTier") as string;

  const limits = await findTierRateLimits(db, userTier);

  // Check per-minute limit
  if (limits) {
    const minuteCount = await getMinuteRequestCount(db, userId);
    if (minuteCount >= limits.requestsPerMinute) {
      throw new HttpError(429, "Rate limit exceeded: too many requests per minute");
    }
  }

  // Check credit balance
  const creditBalance = await ensureCreditBalance(db, userId, userTier);
  if (creditBalance && creditBalance.balance <= 0) {
    throw new HttpError(
      429,
      "You have run out of credits for this billing period. Upgrade your plan or wait for your credits to reset.",
    );
  }

  // Log this request for minute tracking
  await logMinuteRequest(db, userId);

  await next();
};
