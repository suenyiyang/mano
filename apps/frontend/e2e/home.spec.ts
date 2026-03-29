import { expect, test } from "@playwright/test";

test.describe("Root redirect", () => {
  test("redirects / to /login when not authenticated", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });
});
