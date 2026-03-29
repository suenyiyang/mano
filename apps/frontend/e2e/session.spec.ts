import { expect, test } from "@playwright/test";
import { mockEmptyMessages, mockSessionDetail, setupAuthenticated } from "./helpers.js";

test.describe("Session page (/app/:sessionId)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
  });

  test("renders session topbar with title", async ({ page }) => {
    await page.goto("/app/s1");

    await expect(page.locator("main").getByText("Test Session")).toBeVisible();
  });

  test("renders the chat input with follow-up placeholder", async ({ page }) => {
    await page.goto("/app/s1");

    await expect(page.getByPlaceholder("Send a follow-up...")).toBeVisible();
  });

  test("highlights active session in sidebar", async ({ page }) => {
    await page.goto("/app/s1");

    const sessionLink = page.locator("aside").getByText("Test Session");
    await expect(sessionLink).toBeVisible();
    // Active session should have font-medium class
    await expect(sessionLink).toHaveCSS("font-weight", "500");
  });

  test("renders messages from API", async ({ page }) => {
    // Override the messages mock with actual messages
    await page.route("**/api/sessions/s1/messages/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            {
              id: "m1",
              sessionId: "s1",
              role: "user",
              content: "Hello, build me a website",
              toolCalls: null,
              toolCallId: null,
              toolName: null,
              ordinal: 1,
              modelId: null,
              responseId: null,
              tokenUsage: null,
              isCompacted: false,
              createdAt: "2025-01-01T14:30:00Z",
            },
            {
              id: "m2",
              sessionId: "s1",
              role: "assistant",
              content: "I'll create a website for you.",
              toolCalls: null,
              toolCallId: null,
              toolName: null,
              ordinal: 2,
              modelId: "doubao-seed",
              responseId: "r1",
              tokenUsage: null,
              isCompacted: false,
              createdAt: "2025-01-01T14:30:05Z",
            },
          ],
          nextCursor: null,
        }),
      }),
    );

    await page.goto("/app/s1");

    // User message should be visible
    await expect(page.getByText("Hello, build me a website")).toBeVisible();
    // Agent message should be visible
    await expect(page.getByText("I'll create a website for you.")).toBeVisible();
    // Agent header should show "Mano"
    await expect(page.locator("main").getByText("Mano", { exact: true })).toBeVisible();
  });

  test("renders tool call blocks in agent messages", async ({ page }) => {
    await page.route("**/api/sessions/s1/messages/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            {
              id: "m1",
              sessionId: "s1",
              role: "assistant",
              content: "Let me write the file.",
              toolCalls: [
                {
                  id: "tc1",
                  name: "write_file",
                  arguments: '{"path":"index.html"}',
                },
              ],
              toolCallId: null,
              toolName: null,
              ordinal: 1,
              modelId: null,
              responseId: "r1",
              tokenUsage: null,
              isCompacted: false,
              createdAt: "2025-01-01T14:30:00Z",
            },
            {
              id: "m2",
              sessionId: "s1",
              role: "tool",
              content: "File written successfully",
              toolCalls: null,
              toolCallId: "tc1",
              toolName: "write_file",
              ordinal: 2,
              modelId: null,
              responseId: "r1",
              tokenUsage: null,
              isCompacted: false,
              createdAt: "2025-01-01T14:30:01Z",
            },
          ],
          nextCursor: null,
        }),
      }),
    );

    await page.goto("/app/s1");

    await expect(page.getByText("Let me write the file.")).toBeVisible();
    await expect(page.getByText("write_file")).toBeVisible();
  });

  test("navigating between sessions changes content", async ({ page }) => {
    // Add a second session
    await page.route("**/api/sessions/list*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessions: [
            {
              id: "s1",
              userId: "user-1",
              title: "Test Session",
              systemPrompt: "",
              modelTier: "pro",
              createdAt: "2025-01-01T00:00:00Z",
              updatedAt: "2025-01-01T00:00:00Z",
            },
            {
              id: "s2",
              userId: "user-1",
              title: "Second Session",
              systemPrompt: "",
              modelTier: "pro",
              createdAt: "2025-01-02T00:00:00Z",
              updatedAt: "2025-01-02T00:00:00Z",
            },
          ],
          nextCursor: null,
        }),
      }),
    );
    await mockSessionDetail(page, "s2", "Second Session");

    await page.goto("/app/s1");

    // Click the second session in the sidebar
    await page.locator("aside").getByText("Second Session").click();
    await page.waitForURL("**/app/s2");

    await expect(page.getByText("Second Session")).toBeVisible();
  });
});
