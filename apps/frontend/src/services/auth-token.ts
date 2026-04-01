const SESSION_KEY = "mano_has_session";

export const authSession = {
  /** Optimistic hint — verified by /api/auth/me. */
  hasSession: (): boolean => localStorage.getItem(SESSION_KEY) === "1",
  markLoggedIn: () => localStorage.setItem(SESSION_KEY, "1"),
  markLoggedOut: () => localStorage.removeItem(SESSION_KEY),
};
