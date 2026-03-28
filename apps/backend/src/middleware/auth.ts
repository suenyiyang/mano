import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "../lib/jwt.js";
import { unauthorized } from "./error-handler.js";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw unauthorized("Missing or invalid authorization header");
  }

  const token = header.slice(7);
  try {
    const payload = await verifyAccessToken(token);
    c.set("userId", payload.userId);
    c.set("userTier", payload.tier);
  } catch {
    throw unauthorized("Invalid or expired token");
  }

  await next();
};
