import { expect, test } from "@playwright/test";
import { mockEmptyMessages, mockSessionDetail, setupAuthenticated } from "./helpers.js";

const mockAssistantMessage = (content: string) =>
  JSON.stringify({
    messages: [
      {
        id: "m1",
        sessionId: "s1",
        role: "assistant",
        content,
        toolCalls: null,
        toolCallId: null,
        toolName: null,
        ordinal: 1,
        modelId: "doubao-seed",
        responseId: "r1",
        tokenUsage: null,
        isCompacted: false,
        createdAt: "2025-01-01T14:30:00Z",
      },
    ],
    nextCursor: null,
  });

test.describe("Markdown rendering", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
  });

  test("does not render single-tilde ranges as strikethrough", async ({ page }) => {
    await page.route("**/api/sessions/s1/messages/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: mockAssistantMessage("15~16 and 17~18"),
      }),
    );

    await page.goto("/app/s1");

    await expect(page.getByText("15~16 and 17~18")).toBeVisible();
    await expect(page.locator("main del")).toHaveCount(0);
  });

  test("renders double-tilde text as strikethrough", async ({ page }) => {
    await page.route("**/api/sessions/s1/messages/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: mockAssistantMessage("This is ~~deleted~~ text"),
      }),
    );

    await page.goto("/app/s1");

    await expect(page.locator("main del")).toHaveText("deleted");
  });

  test("does not render single-tilde wrapped text as strikethrough", async ({ page }) => {
    await page.route("**/api/sessions/s1/messages/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: mockAssistantMessage("~single tilde~ should not strike"),
      }),
    );

    await page.goto("/app/s1");

    await expect(page.getByText("~single tilde~ should not strike")).toBeVisible();
    await expect(page.locator("main del")).toHaveCount(0);
  });
});
