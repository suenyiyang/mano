import { describe, expect, it } from "vitest";
import app from "./app.js";

describe("Mano API", () => {
  it("GET / returns welcome message", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ message: "Mano API" });
  });

  it("GET /api/health returns status ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
