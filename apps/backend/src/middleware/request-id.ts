import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export const requestId: MiddlewareHandler = async (c, next) => {
  const id = c.req.header("x-request-id") || randomUUID();
  c.header("X-Request-ID", id);
  await next();
};
