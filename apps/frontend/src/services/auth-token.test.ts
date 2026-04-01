import { afterEach, describe, expect, it, vi } from "vitest";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Import after mocking
const { authSession } = await import("./auth-token.js");

describe("authSession", () => {
  afterEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    vi.clearAllMocks();
  });

  it("returns false when no session hint exists", () => {
    expect(authSession.hasSession()).toBe(false);
  });

  it("markLoggedIn sets the session hint", () => {
    authSession.markLoggedIn();

    expect(authSession.hasSession()).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("mano_has_session", "1");
  });

  it("markLoggedOut clears the session hint", () => {
    authSession.markLoggedIn();
    authSession.markLoggedOut();

    expect(authSession.hasSession()).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("mano_has_session");
  });

  it("hasSession reflects current state after multiple toggles", () => {
    authSession.markLoggedIn();
    expect(authSession.hasSession()).toBe(true);

    authSession.markLoggedOut();
    expect(authSession.hasSession()).toBe(false);

    authSession.markLoggedIn();
    expect(authSession.hasSession()).toBe(true);
  });
});
