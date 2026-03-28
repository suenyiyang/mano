import { describe, expect, it } from "vitest";
import app from "../app.js";

describe("API Contract: /api/health", () => {
  it("responds with 200 and JSON content-type", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("response body matches frontend expected shape", async () => {
    const res = await app.request("/api/health");
    const body = (await res.json()) as { status: string };

    expect(body).toHaveProperty("status");
    expect(typeof body.status).toBe("string");
    expect(body.status).toBe("ok");
  });

  it("GET / returns the welcome message shape", async () => {
    const res = await app.request("/");
    const body = (await res.json()) as { message: string };

    expect(body).toHaveProperty("message");
    expect(typeof body.message).toBe("string");
  });
});
