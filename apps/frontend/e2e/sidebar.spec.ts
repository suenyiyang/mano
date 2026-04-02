import { expect, test } from "@playwright/test";
import { mockEmptyMessages, mockSessionDetail, setupAuthenticated } from "./helpers.js";

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

test.describe("Sidebar toggle (desktop)", () => {
  test("close button hides sidebar, open button restores it", async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto("/app");

    // Sidebar should be visible initially on desktop
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("Mano")).toBeVisible();
    const openButton = page.getByTitle("Open sidebar");
    await expect(openButton).not.toBeVisible();

    // Click close button — sidebar collapses to w-0
    await page.getByTitle("Close sidebar").click();

    // Open button should appear (confirms sidebar is closed)
    await expect(openButton).toBeVisible();

    // Click open button to restore
    await openButton.click();
    await expect(sidebar.getByText("Mano")).toBeVisible();
    await expect(openButton).not.toBeVisible();
  });

  test("renders close sidebar button in header", async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto("/app");

    await expect(page.getByTitle("Close sidebar")).toBeVisible();
  });
});

test.describe("Sidebar responsive (mobile)", () => {
  test("sidebar is closed by default on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticated(page);
    await page.goto("/app");

    // Open button should be visible (sidebar is closed)
    await expect(page.getByTitle("Open sidebar")).toBeVisible();
  });

  test("open button shows sidebar as drawer with backdrop on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticated(page);
    await page.goto("/app");

    // Open sidebar
    await page.getByTitle("Open sidebar").click();

    // Sidebar content should now be visible
    await expect(page.locator("aside").getByText("Mano")).toBeVisible();

    // Backdrop should be visible
    await expect(page.getByLabel("Close sidebar")).toBeVisible();
  });

  test("clicking close button closes mobile drawer", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticated(page);
    await page.goto("/app");

    // Open sidebar
    await page.getByTitle("Open sidebar").click();
    await expect(page.locator("aside").getByText("Mano")).toBeVisible();

    // Click the close button inside the sidebar header
    await page.getByTitle("Close sidebar").click();

    // Open button reappears (confirms sidebar is closed)
    await expect(page.getByTitle("Open sidebar")).toBeVisible();
  });

  test("navigating to a session closes mobile drawer", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
    await page.goto("/app");

    // Open sidebar
    await page.getByTitle("Open sidebar").click();
    await expect(page.locator("aside").getByText("Test Session")).toBeVisible();

    // Click session link
    await page.locator("aside").getByText("Test Session").click();
    await page.waitForURL("**/app/s1");

    // Open button reappears (confirms sidebar auto-closed after navigation)
    await expect(page.getByTitle("Open sidebar")).toBeVisible();
  });

  test("resizing from mobile to desktop auto-opens sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAuthenticated(page);
    await page.goto("/app");

    // Sidebar closed on mobile
    await expect(page.getByTitle("Open sidebar")).toBeVisible();

    // Resize to desktop
    await page.setViewportSize({ width: 1280, height: 720 });

    // Sidebar should auto-open
    await expect(page.locator("aside").getByText("Mano")).toBeVisible();
    await expect(page.getByTitle("Open sidebar")).not.toBeVisible();
  });

  test("resizing from desktop to mobile auto-closes sidebar", async ({ page }) => {
    await setupAuthenticated(page);
    await page.goto("/app");

    // Sidebar visible on desktop
    await expect(page.locator("aside").getByText("Mano")).toBeVisible();

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 812 });

    // Open button appears (confirms sidebar auto-closed)
    await expect(page.getByTitle("Open sidebar")).toBeVisible();
  });
});
