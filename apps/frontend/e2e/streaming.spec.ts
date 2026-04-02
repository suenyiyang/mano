import type { Page, Route } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { mockEmptyMessages, mockSessionDetail, setupAuthenticated } from "./helpers.js";

// ─── SSE helpers ──────────────────────────────────────────────────────────

/** Format a single SSE event line */
const sseEvent = (event: string, data: object): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Build an SSE body from events */
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

const toolCallStart = (toolCallId: string, name: string) => ({
  event: "tool_call_start",
  data: { type: "tool_call_start", toolCallId, name },
});

const toolCallDelta = (toolCallId: string, argumentsDelta: string) => ({
  event: "tool_call_delta",
  data: { type: "tool_call_delta", toolCallId, argumentsDelta },
});

const toolCallEnd = (toolCallId: string) => ({
  event: "tool_call_end",
  data: { type: "tool_call_end", toolCallId },
});

const toolResult = (toolCallId: string, content: string, isError = false) => ({
  event: "tool_result",
  data: { type: "tool_result", toolCallId, content, isError },
});

const done = () => ({
  event: "done",
  data: { type: "done", usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
});

const sseError = (error: string, code: string) => ({
  event: "error",
  data: { type: "error", error, code },
});

/** Mock no active generation for a session */
const mockNoActiveGeneration = async (page: Page) => {
  await page.route("**/api/sessions/*/chat/active", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ active: false }),
    }),
  );
};

/** Fulfill a route with SSE events (streaming still "in progress" — no DONE) */
const fulfillSseStream = (route: Route, ...events: Array<{ event: string; data: object }>) =>
  route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: sseBody(...events),
  });

// ─── Initial message deduplication ────────────────────────────────────────

test.describe("Initial message from new chat", () => {
  test("sends initial message exactly once when navigating from new chat", async ({ page }) => {
    await setupAuthenticated(page);

    // Mock session creation
    await page.route("**/api/sessions/create", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: "new-s1",
            userId: "user-1",
            title: null,
            systemPrompt: "",
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

    await mockSessionDetail(page, "new-s1", "Untitled");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);

    // Track /send request count — omit done() so streaming blocks stay visible
    let sendCount = 0;
    await page.route("**/api/sessions/new-s1/chat/send", (route) => {
      sendCount++;
      return fulfillSseStream(route, responseStart("r1"), textDelta("Got it."));
    });

    await page.goto("/app");
    const textarea = page.getByPlaceholder("Describe your task...");
    await textarea.fill("Build me a website");
    await textarea.press("Enter");

    // Wait for navigation to session page
    await page.waitForURL("**/app/new-s1");

    // Streamed text should appear
    await expect(page.getByText("Got it.")).toBeVisible();

    // Critical: exactly one /send request (not two from StrictMode)
    expect(sendCount).toBe(1);
  });
});

// ─── Send message and SSE streaming ───────────────────────────────────────

test.describe("Send message and SSE streaming", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);
  });

  test("sends a message and streams text response", async ({ page }) => {
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      fulfillSseStream(route, responseStart("r1"), textDelta("Hello! I can help you with that.")),
    );

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("Help me build something");
    await textarea.press("Enter");

    // User message bubble appears immediately
    await expect(page.getByText("Help me build something")).toBeVisible();
    // Streamed text appears in a live agent message
    await expect(page.getByText("Hello! I can help you with that.")).toBeVisible();
    // Agent header with avatar
    await expect(page.locator("main").getByText("Mano", { exact: true })).toBeVisible();
  });

  test("streams a response with tool calls", async ({ page }) => {
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      fulfillSseStream(
        route,
        responseStart("r1"),
        textDelta("Let me write that file."),
        toolCallStart("tc1", "write_file"),
        toolCallDelta("tc1", '{"path":"index.html"}'),
        toolCallEnd("tc1"),
        toolResult("tc1", "File written successfully"),
        textDelta("Done! File created."),
      ),
    );

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("Write an HTML file");
    await textarea.press("Enter");

    // User message visible
    await expect(page.getByText("Write an HTML file")).toBeVisible();
    // Agent streaming content
    await expect(page.getByText("Let me write that file.")).toBeVisible();
    await expect(page.getByText("write_file")).toBeVisible();
    await expect(page.getByText("Done! File created.")).toBeVisible();

    // Tool result is hidden until expanded
    await expect(page.getByText("File written successfully")).not.toBeVisible();
    // Click tool call to expand
    await page.getByText("write_file").click();
    await expect(page.getByText("File written successfully")).toBeVisible();
    // Click again to collapse
    await page.getByText("write_file").click();
    await expect(page.getByText("File written successfully")).not.toBeVisible();
  });

  test("shows stop button while streaming and hides feedback buttons", async ({ page }) => {
    // Stream with no DONE — isStreaming stays true
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      fulfillSseStream(route, responseStart("r1"), textDelta("Working on it...")),
    );

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("Do something");
    await textarea.press("Enter");

    // User message and stop button visible during streaming
    await expect(page.getByText("Do something")).toBeVisible();
    await expect(page.getByTitle("Stop generating")).toBeVisible();
    await expect(page.getByText("Working on it...")).toBeVisible();

    // Feedback buttons should NOT be visible during streaming
    await expect(page.getByTitle("Good response")).not.toBeVisible();
    await expect(page.getByTitle("Bad response")).not.toBeVisible();
  });

  test("send button returns after stream completes", async ({ page }) => {
    // Include DONE so streaming completes
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(responseStart("r1"), textDelta("Finished."), done()),
      }),
    );

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("Quick task");
    await textarea.press("Enter");

    // After stream completes, stop button should not be present
    await expect(page.getByTitle("Stop generating")).not.toBeVisible({ timeout: 3000 });
  });

  test("shows feedback buttons after stream completes and toggles on click", async ({ page }) => {
    // Include DONE so streaming completes
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(responseStart("r1"), textDelta("Here is the answer."), done()),
      }),
    );

    // Mock persisted messages after refetch
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
              content: "Ask something",
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
              content: "Here is the answer.",
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
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("Ask something");
    await textarea.press("Enter");

    // Wait for stream completion and refetch
    await expect(page.getByTitle("Stop generating")).not.toBeVisible({ timeout: 3000 });

    // Feedback buttons should appear
    const likeBtn = page.getByTitle("Good response");
    const dislikeBtn = page.getByTitle("Bad response");
    await expect(likeBtn).toBeVisible();
    await expect(dislikeBtn).toBeVisible();

    // Click like — should toggle on
    await likeBtn.click();
    // Click like again — should toggle off
    await likeBtn.click();

    // Click dislike — should toggle on
    await dislikeBtn.click();
    // Click dislike again — should toggle off
    await dislikeBtn.click();
  });

  test("displays streaming error", async ({ page }) => {
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(
          responseStart("r1"),
          textDelta("Starting..."),
          sseError("Rate limit exceeded", "rate_limit"),
        ),
      }),
    );

    await page.goto("/app/s1");
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("Trigger error");
    await textarea.press("Enter");

    await expect(page.getByText("Rate limit exceeded")).toBeVisible();
  });
});

// ─── SSE resume on reconnect ──────────────────────────────────────────────

test.describe("SSE resume on reconnect", () => {
  test("resumes an active generation on page load", async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);

    // Report an active generation
    await page.route("**/api/sessions/s1/chat/active", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ active: true, responseId: "r-active" }),
      }),
    );

    // Resume endpoint delivers remaining events (no DONE — keeps streaming visible)
    await page.route("**/api/sessions/s1/chat/r-active/resume", (route) =>
      fulfillSseStream(route, textDelta("Resumed content here.")),
    );

    await page.goto("/app/s1");

    await expect(page.getByText("Resumed content here.")).toBeVisible();
    // Streaming indicator should be present since generation is still active
    await expect(page.getByTitle("Stop generating")).toBeVisible();
  });

  test("does not call resume when no active generation", async ({ page }) => {
    await setupAuthenticated(page, [{ id: "s1", title: "Test Session" }]);
    await mockSessionDetail(page, "s1", "Test Session");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);

    let resumeCalled = false;
    await page.route("**/api/sessions/s1/chat/*/resume", (route) => {
      resumeCalled = true;
      route.abort();
    });

    await page.goto("/app/s1");
    await page.waitForTimeout(500);

    expect(resumeCalled).toBe(false);
  });
});

// ─── Session switching during streaming ───────────────────────────────────

test.describe("Session switching while streaming", () => {
  const setupTwoSessions = async (page: Page) => {
    await setupAuthenticated(page, [
      { id: "s1", title: "Session Alpha" },
      { id: "s2", title: "Session Beta" },
    ]);
    await mockSessionDetail(page, "s1", "Session Alpha");
    await mockSessionDetail(page, "s2", "Session Beta");
    await mockEmptyMessages(page);
    await mockNoActiveGeneration(page);
  };

  test("switch to another session while streaming, then switch back", async ({ page }) => {
    await setupTwoSessions(page);

    // Session 1: stream stays open (no DONE)
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      fulfillSseStream(route, responseStart("r1"), textDelta("Alpha is thinking...")),
    );

    // Start streaming on session 1
    await page.goto("/app/s1");
    const textarea1 = page.getByPlaceholder("Send a follow-up...");
    await textarea1.fill("Alpha question");
    await textarea1.press("Enter");

    // Both user message and agent response visible
    await expect(page.getByText("Alpha question")).toBeVisible();
    await expect(page.getByText("Alpha is thinking...")).toBeVisible();
    await expect(page.getByTitle("Stop generating")).toBeVisible();

    // Switch to session 2
    await page.locator("aside").getByText("Session Beta").click();
    await page.waitForURL("**/app/s2");
    await expect(page.locator("main").getByText("Session Beta")).toBeVisible();

    // Session 2 should not show session 1's content
    await expect(page.getByText("Alpha is thinking...")).not.toBeVisible();
    // Session 2 is not streaming — no stop button
    await expect(page.getByTitle("Stop generating")).not.toBeVisible();

    // Send message on session 2
    await page.route("**/api/sessions/s2/chat/send", (route) =>
      fulfillSseStream(route, responseStart("r2"), textDelta("Beta response here.")),
    );

    const textarea2 = page.getByPlaceholder("Send a follow-up...");
    await textarea2.fill("Beta question");
    await textarea2.press("Enter");

    await expect(page.getByText("Beta question")).toBeVisible();
    await expect(page.getByText("Beta response here.")).toBeVisible();
    await expect(page.getByTitle("Stop generating")).toBeVisible();

    // Switch back to session 1 — mock active generation for resume
    await page.route("**/api/sessions/s1/chat/active", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ active: true, responseId: "r1" }),
      }),
    );

    // Mock resume endpoint for session 1
    await page.route("**/api/sessions/s1/chat/r1/resume", (route) =>
      fulfillSseStream(route, textDelta("Alpha resumed.")),
    );

    await page.locator("aside").getByText("Session Alpha").click();
    await page.waitForURL("**/app/s1");

    // Should see resumed streaming content (not session 2's content)
    await expect(page.getByText("Alpha resumed.")).toBeVisible();
    await expect(page.getByText("Beta response here.")).not.toBeVisible();
    await expect(page.getByTitle("Stop generating")).toBeVisible();
  });

  test("each session has independent streaming state", async ({ page }) => {
    await setupTwoSessions(page);

    // Session 1: completes immediately (with DONE)
    await page.route("**/api/sessions/s1/chat/send", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(responseStart("r1"), textDelta("Alpha done instantly."), done()),
      }),
    );

    // Mock messages for session 1 — returned after refetch
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
              content: "Quick question",
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
              content: "Alpha done instantly.",
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
    const textarea = page.getByPlaceholder("Send a follow-up...");
    await textarea.fill("Quick question");
    await textarea.press("Enter");

    // Stream completed — persisted message visible from refetch
    await expect(page.getByText("Alpha done instantly.")).toBeVisible();
    await expect(page.getByTitle("Stop generating")).not.toBeVisible();

    // Feedback buttons visible on completed message
    await expect(page.getByTitle("Good response")).toBeVisible();
    await expect(page.getByTitle("Bad response")).toBeVisible();

    // Session 2: still streaming (no DONE)
    await page.route("**/api/sessions/s2/chat/send", (route) =>
      fulfillSseStream(
        route,
        responseStart("r2"),
        textDelta("Beta working..."),
        toolCallStart("tc1", "write_file"),
        toolCallDelta("tc1", '{"path":"app.tsx"}'),
        toolCallEnd("tc1"),
      ),
    );

    // Switch to session 2
    await page.locator("aside").getByText("Session Beta").click();
    await page.waitForURL("**/app/s2");

    const textarea2 = page.getByPlaceholder("Send a follow-up...");
    await textarea2.fill("Build a file");
    await textarea2.press("Enter");

    // Session 2 shows its streaming content
    await expect(page.getByText("Beta working...")).toBeVisible();
    await expect(page.getByText("write_file")).toBeVisible();
    await expect(page.getByTitle("Stop generating")).toBeVisible();

    // Switch back to session 1 — should not show session 2's content
    await page.locator("aside").getByText("Session Alpha").click();
    await page.waitForURL("**/app/s1");

    await expect(page.getByText("Alpha done instantly.")).toBeVisible();
    await expect(page.getByText("write_file")).not.toBeVisible();
    await expect(page.getByText("Beta working...")).not.toBeVisible();
    await expect(page.getByTitle("Stop generating")).not.toBeVisible();
  });
});
