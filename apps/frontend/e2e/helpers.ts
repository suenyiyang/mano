import type { Page } from "@playwright/test";

/** Mock the auth/me endpoint to simulate a logged-in user */
export const mockAuthenticatedUser = async (page: Page) => {
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
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      }),
    }),
  );
};

/** Mock session list endpoint */
export const mockSessionList = async (
  page: Page,
  sessions: Array<{ id: string; title: string }> = [],
) => {
  await page.route("**/api/sessions/list*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessions: sessions.map((s) => ({
          id: s.id,
          userId: "user-1",
          title: s.title,
          systemPrompt: "",
          forkedFromSessionId: null,
          forkedAtMessageId: null,
          compactSummary: null,
          compactAfterMessageId: null,
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
        })),
        nextCursor: null,
      }),
    }),
  );
};

/** Mock an empty message list */
export const mockEmptyMessages = async (page: Page) => {
  await page.route("**/api/sessions/*/messages/list*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages: [], nextCursor: null }),
    }),
  );
};

/** Mock session detail */
export const mockSessionDetail = async (page: Page, sessionId: string, title: string) => {
  await page.route(`**/api/sessions/${sessionId}/detail`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: sessionId,
          userId: "user-1",
          title,
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
};

/** Set session hint in localStorage before page loads */
export const setAuthTokens = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem("mano_has_session", "1");
  });
};

/** Full setup for an authenticated user with mocked APIs */
export const setupAuthenticated = async (
  page: Page,
  sessions: Array<{ id: string; title: string }> = [],
) => {
  await setAuthTokens(page);
  await mockAuthenticatedUser(page);
  await mockSessionList(page, sessions);
};
