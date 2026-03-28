import type { MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

export const errorHandler: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ZodError) {
      return c.json({ error: "Validation failed", details: error.flatten() }, 400);
    }

    if (error instanceof HttpError) {
      return c.json({ error: error.message }, error.status as ContentfulStatusCode);
    }

    console.error("Unhandled error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (message = "Not found") => new HttpError(404, message);
export const badRequest = (message = "Bad request") => new HttpError(400, message);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, message);
export const forbidden = (message = "Forbidden") => new HttpError(403, message);
export const conflict = (message = "Conflict") => new HttpError(409, message);
