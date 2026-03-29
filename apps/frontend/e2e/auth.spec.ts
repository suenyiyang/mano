import { expect, test } from "@playwright/test";

test.describe("Login page", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mano");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("shows OAuth buttons", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("button", { name: "GitHub" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
  });

  test("has link to register page", async ({ page }) => {
    await page.goto("/login");

    const link = page.getByRole("link", { name: "Sign up" });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/register");
  });

  test("submits login form and redirects on success", async ({ page }) => {
    // Mock the login endpoint
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            email: "test@example.com",
            displayName: "Test User",
            avatarUrl: null,
            tier: "pro",
          },
          token: "fake-jwt",
          refreshToken: "fake-refresh",
        }),
      }),
    );

    // Mock auth/me for after redirect
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-1",
            email: "test@example.com",
            displayName: "Test User",
            avatarUrl: null,
            tier: "pro",
          },
        }),
      }),
    );

    // Mock sessions list for after redirect
    await page.route("**/api/sessions/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [], nextCursor: null }),
      }),
    );

    await page.goto("/login");

    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByPlaceholder("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Should redirect to /app
    await page.waitForURL("**/app");

    // Verify tokens were stored
    const token = await page.evaluate(() => localStorage.getItem("mano_token"));
    expect(token).toBe("fake-jwt");
  });

  test("shows error on login failure", async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      }),
    );

    await page.goto("/login");

    await page.getByPlaceholder("Email").fill("bad@example.com");
    await page.getByPlaceholder("Password").fill("wrongpass");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });
});

test.describe("Register page", () => {
  test("renders the register form", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mano");
    await expect(page.getByText("Create your account")).toBeVisible();
    await expect(page.getByPlaceholder("Display name")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password (min 8 characters)")).toBeVisible();
  });

  test("has link to login page", async ({ page }) => {
    await page.goto("/register");

    const link = page.getByRole("link", { name: "Sign in" });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/login");
  });
});
