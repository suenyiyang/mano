import type { Route } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mockEmptyMessages, mockSessionDetail, setupAuthenticated } from "./helpers.js";

// ─── SSE helpers ──────────────────────────────────────────────────────────

const sseEvent = (event: string, data: object): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const sseBody = (...events: Array<{ event: string; data: object }>): string =>
  events.map((e) => sseEvent(e.event, e.data)).join("");

const responseStart = (responseId: string) => ({
  event: "response_start",
  data: { type: "response_start", responseId },
});

const textDelta = (text: string) => ({
  event: "text_delta",
  data: { type: "text_delta", text },
});

const fulfillSseStream = (route: Route, ...events: Array<{ event: string; data: object }>) =>
  route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: sseBody(...events),
  });

const mockNoActiveGeneration = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/sessions/*/chat/active", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ active: false }),
    }),
  );
};

// ─── Click area ──────────────────────────────────────────────────────────

test.describe("Chat input click area", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);
  });

  test("clicking below the textarea focuses the input", async ({ page }) => {
    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await expect(textarea).toBeVisible();

    // Click elsewhere to ensure textarea is not focused
    await page.locator("main").click({ position: { x: 10, y: 10 } });
    await expect(textarea).not.toBeFocused();

    // Click in the gap between textarea and the action bar (below the textarea)
    const textareaBox = await textarea.boundingBox();
    if (!textareaBox) throw new Error("textarea bounding box not found");
    await page.mouse.click(
      textareaBox.x + textareaBox.width / 2,
      textareaBox.y + textareaBox.height + 5,
    );

    await expect(textarea).toBeFocused();
  });
});

// ─── IME composition ─────────────────────────────────────────────────────

test.describe("IME composition handling", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);
  });

  test("does not send message when Enter is pressed during IME composition", async ({ page }) => {
    let sendCount = 0;
    await page.route("**/api/sessions/s1/chat/send", (route) => {
      sendCount++;
      return fulfillSseStream(route, responseStart("r1"), textDelta("Response"));
    });

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("hello");

    // Simulate Enter during IME composition
    await textarea.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      );
    });

    await page.waitForTimeout(500);
    expect(sendCount).toBe(0);
    await expect(textarea).toHaveValue("hello");
  });
});

// ─── Enter during streaming ─────────────────────────────────────────────

test.describe("Enter during streaming", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);
  });

  test("Enter does not clear input while streaming", async ({ page }) => {
    // Use a pending promise so the SSE stream stays open (simulates streaming state)
    await page.route("**/api/sessions/s1/chat/send", (route) => {
      // Fulfill with response_start only — no done event keeps isStreaming=true
      return fulfillSseStream(route, responseStart("r1"), textDelta("Thinking..."));
    });

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("first message");
    await textarea.press("Enter");

    // Wait for streaming indicator (stop button)
    await expect(page.getByTitle("Stop generating")).toBeVisible();

    // Type a second message while streaming
    await textarea.fill("second message");
    await textarea.press("Enter");

    // Input should NOT be cleared — the message was blocked by isStreaming guard
    await expect(textarea).toHaveValue("second message");
  });
});

// ─── Double send prevention ─────────────────────────────────────────────

test.describe("Double send prevention", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);
  });

  test("rapid double-Enter sends only one request", async ({ page }) => {
    let sendCount = 0;
    await page.route("**/api/sessions/s1/chat/send", (route) => {
      sendCount++;
      return fulfillSseStream(route, responseStart("r1"), textDelta("Got it."));
    });

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("test message");

    // Dispatch two Enter keydowns synchronously (same tick — React can't re-render between them)
    await textarea.evaluate((el) => {
      const makeEnter = () =>
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        });
      el.dispatchEvent(makeEnter());
      el.dispatchEvent(makeEnter());
    });

    // Streamed response should render correctly
    await expect(page.getByText("Got it.")).toBeVisible();

    // Only one /send request should have been made
    expect(sendCount).toBe(1);
  });
});
