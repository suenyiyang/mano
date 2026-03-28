import { expect, test } from "@playwright/test";

test.describe("with mocked API", () => {
  test("intercepts /api/health and returns mocked response", async ({ page }) => {
    await page.route("**/api/health", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      }),
    );

    await page.goto("/");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/health");
      return { status: res.status, body: await res.json() };
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
