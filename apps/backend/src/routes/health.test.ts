import { describe, expect, it } from "vitest";
import { healthRoutes } from "./health.js";

describe("GET /health", () => {
  it("returns status ok", async () => {
    const res = await healthRoutes.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
