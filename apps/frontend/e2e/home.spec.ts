import { expect, test } from "@playwright/test";

test.describe("Home page", () => {
  test("displays the app heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mano");
  });

  test("displays the status message", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Frontend is running.")).toBeVisible();
  });
});
