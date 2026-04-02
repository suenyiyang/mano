import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Db } from "../db/index.js";
import { createAuthSession } from "../db/queries/auth-sessions.js";
import { getEnv } from "../env.js";

export const SESSION_COOKIE = "mano_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export const setSessionCookie = (c: Context, sessionId: string) => {
  const env = getEnv();
  const isProduction = env.FRONTEND_URL.startsWith("https");
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
};

export const clearSessionCookie = (c: Context) => {
  const env = getEnv();
  const isProduction = env.FRONTEND_URL.startsWith("https");
  setCookie(c, SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
};

export const getSessionCookie = (c: Context): string | undefined => {
  return getCookie(c, SESSION_COOKIE);
};

export const createSessionAndSetCookie = async (c: Context, db: Db, userId: string) => {
  const session = await createAuthSession(db, { userId });
  setSessionCookie(c, session.id);
  return session;
};
