import type { MiddlewareHandler } from "hono";
import { getMinuteRequestCount, logMinuteRequest } from "../db/queries/rate-limits.js";
import { HttpError } from "./error-handler.js";

const DEFAULT_REQUESTS_PER_MINUTE = 20;

/**
 * Rate limit middleware for chat endpoints.
 * Checks per-minute request limit.
 * Should be applied AFTER authMiddleware (needs userId).
 */
export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  // Skip rate limiting in development
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const db = c.var.db;
  const userId = c.get("userId") as string;

  const minuteCount = await getMinuteRequestCount(db, userId);
  if (minuteCount >= DEFAULT_REQUESTS_PER_MINUTE) {
    throw new HttpError(429, "Rate limit exceeded: too many requests per minute");
  }

  // Log this request for minute tracking
  await logMinuteRequest(db, userId);

  await next();
};
