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
const { authToken } = await import("./auth-token.js");

describe("authToken", () => {
  afterEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
    vi.clearAllMocks();
  });

  it("returns null when no tokens are stored", () => {
    expect(authToken.get()).toBeNull();
    expect(authToken.getRefresh()).toBeNull();
  });

  it("stores and retrieves tokens", () => {
    authToken.set("access-123", "refresh-456");

    expect(authToken.get()).toBe("access-123");
    expect(authToken.getRefresh()).toBe("refresh-456");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("mano_token", "access-123");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("mano_refresh_token", "refresh-456");
  });

  it("clears both tokens", () => {
    authToken.set("access-123", "refresh-456");
    authToken.clear();

    expect(authToken.get()).toBeNull();
    expect(authToken.getRefresh()).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("mano_token");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("mano_refresh_token");
  });

  it("overwrites existing tokens", () => {
    authToken.set("old-access", "old-refresh");
    authToken.set("new-access", "new-refresh");

    expect(authToken.get()).toBe("new-access");
    expect(authToken.getRefresh()).toBe("new-refresh");
  });
});
