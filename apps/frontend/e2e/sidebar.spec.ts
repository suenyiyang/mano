import { expect, test } from "@playwright/test";
import { setupAuthenticated } from "./helpers.js";

test.describe("Sidebar", () => {
  test("renders logo and new chat button", async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto("/app");

    await expect(page.locator("aside").getByText("Mano")).toBeVisible();
    await expect(page.getByTitle("New chat")).toBeVisible();
  });

  test("renders search input", async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto("/app");

    await expect(page.getByPlaceholder("Search...")).toBeVisible();
  });

  test("renders session list", async ({ page }) => {
    await setupAuthenticated(page, [
      { id: "s1", title: "Build a landing page" },
      { id: "s2", title: "Debug API issue" },
      { id: "s3", title: "Write unit tests" },
    ]);
    await page.goto("/app");

    await expect(page.getByText("Build a landing page")).toBeVisible();
    await expect(page.getByText("Debug API issue")).toBeVisible();
    await expect(page.getByText("Write unit tests")).toBeVisible();
  });

  test("shows empty state when no sessions", async ({ page }) => {
    await setupAuthenticated(page, []);
    await page.goto("/app");

    await expect(page.getByText("No conversations yet")).toBeVisible();
  });

  test("filters sessions by search", async ({ page }) => {
    await setupAuthenticated(page, [
      { id: "s1", title: "Build a landing page" },
      { id: "s2", title: "Debug API issue" },
      { id: "s3", title: "Write unit tests" },
    ]);
    await page.goto("/app");

    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.fill("Debug");

    await expect(page.getByText("Debug API issue")).toBeVisible();
    await expect(page.getByText("Build a landing page")).not.toBeVisible();
    await expect(page.getByText("Write unit tests")).not.toBeVisible();
  });

  test("renders user name in footer", async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto("/app");

    await expect(page.locator("aside").getByText("Test User")).toBeVisible();
  });

  test("renders settings button", async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto("/app");

    await expect(page.locator("aside").getByText("Settings")).toBeVisible();
  });

  test("clicking new chat navigates to /app", async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Existing session" }]);

    // Mock session detail for navigation
    await page.route("**/api/sessions/s1/detail", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: "s1",
            userId: "user-1",
            title: "Existing session",
            systemPrompt: "",
            modelTier: "pro",
          },
        }),
      }),
    );
    await page.route("**/api/sessions/s1/messages/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], nextCursor: null }),
      }),
    );

    await page.goto("/app/s1");
    await page.getByTitle("New chat").click();
    await page.waitForURL("**/app");
    expect(page.url()).toMatch(/\/app$/);
  });
});
