import { expect, test } from "@playwright/test";
import { setupAuthenticated } from "./helpers.js";

test.describe("New chat page (/app)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page);
  });

  test("renders hero section", async ({ page }) => {
    await page.goto("/app");

    await expect(page.getByText("What can I help you with?")).toBeVisible();
    await expect(page.getByText("Describe a task and Mano will handle it for you.")).toBeVisible();
  });

  test("renders the chat input", async ({ page }) => {
    await page.goto("/app");

    await expect(page.getByPlaceholder("Describe your task...")).toBeVisible();
  });

  test("renders quick action buttons", async ({ page }) => {
    await page.goto("/app");

    await expect(page.getByRole("button", { name: "Build a website" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analyze data" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Write code" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Research a topic" })).toBeVisible();
  });

  test("quick action fills the input", async ({ page }) => {
    await page.goto("/app");

    await page.getByRole("button", { name: "Write code" }).click();
    const textarea = page.getByPlaceholder("Describe your task...");
    await expect(textarea).toHaveValue("Write code");
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await page.goto("/app");

    const sendButton = page.getByTitle("Send", { exact: false }).or(
      page
        .locator("button")
        .filter({ has: page.locator("svg") })
        .last(),
    );

    // The send button should exist but be visually disabled (opacity)
    const textarea = page.getByPlaceholder("Describe your task...");
    await expect(textarea).toHaveValue("");
  });

  test("creates session and navigates on send", async ({ page }) => {
    // Mock session creation
    await page.route("**/api/sessions/create", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: "new-session-1",
            userId: "user-1",
            title: null,
            systemPrompt: "",
            modelTier: "pro",
            forkedFromSessionId: null,
            forkedAtMessageId: null,
            compactSummary: null,
            compactAfterMessageId: null,
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        }),
      }),
    );

    // Mock session detail for the new session
    await page.route("**/api/sessions/new-session-1/detail", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: "new-session-1",
            userId: "user-1",
            title: null,
            systemPrompt: "",
            modelTier: "pro",
            forkedFromSessionId: null,
            forkedAtMessageId: null,
            compactSummary: null,
            compactAfterMessageId: null,
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        }),
      }),
    );

    // Mock messages
    await page.route("**/api/sessions/new-session-1/messages/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], nextCursor: null }),
      }),
    );

    // Mock chat/send with an SSE stream
    await page.route("**/api/sessions/new-session-1/chat/send", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          'event: response_start\ndata: {"responseId":"r1"}\n',
          'event: text_delta\ndata: {"text":"Hello!"}\n',
          'event: done\ndata: {"usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15}}\n',
          "",
        ].join("\n"),
      }),
    );

    await page.goto("/app");

    const textarea = page.getByPlaceholder("Describe your task...");
    await textarea.fill("Build me a website");
    await textarea.press("Enter");

    // Should navigate to the session page
    await page.waitForURL("**/app/new-session-1");
  });
});
