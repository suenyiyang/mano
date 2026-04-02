import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { deleteAuthSession } from "../db/queries/auth-sessions.js";
import {
  createOauthAccount,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByOauth,
} from "../db/queries/users.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { clearSessionCookie, createSessionAndSetCookie, getSessionCookie } from "../lib/session.js";
import { authMiddleware } from "../middleware/auth.js";
import { badRequest, unauthorized } from "../middleware/error-handler.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/register", async (c) => {
  const db = c.var.db;
  const body = registerSchema.parse(await c.req.json());

  const existing = await findUserByEmail(db, body.email);
  if (existing) {
    throw badRequest("Email already registered");
  }

  const passwordHash = await hashPassword(body.password);
  const user = await createUser(db, {
    email: body.email,
    passwordHash,
    displayName: body.displayName,
  });

  await createSessionAndSetCookie(c, db, user.id);

  return c.json(
    {
      user: { id: user.id, email: user.email, displayName: user.displayName },
    },
    201,
  );
});

authRoutes.post("/login", async (c) => {
  const db = c.var.db;
  const body = loginSchema.parse(await c.req.json());

  const user = await findUserByEmail(db, body.email);
  if (!user?.passwordHash) {
    throw unauthorized("Invalid email or password");
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    throw unauthorized("Invalid email or password");
  }

  await createSessionAndSetCookie(c, db, user.id);

  return c.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

authRoutes.post("/logout", async (c) => {
  const sessionId = getSessionCookie(c);
  if (sessionId) {
    const db = c.var.db;
    await deleteAuthSession(db, sessionId);
  }
  clearSessionCookie(c);
  return c.json({ success: true });
});

authRoutes.get("/me", authMiddleware, async (c) => {
  const db = c.var.db;
  const user = await findUserById(db, c.var.userId);
  if (!user) {
    throw unauthorized("User not found");
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  });
});

// GitHub OAuth - redirect to GitHub
authRoutes.get("/github", (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw badRequest("GitHub OAuth not configured");
  }
  const redirectUri = `${process.env.FRONTEND_URL || "http://localhost:5173"}/api/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  return c.redirect(url);
});

// Google OAuth - redirect to Google
authRoutes.get("/google", (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw badRequest("Google OAuth not configured");
  }
  const redirectUri = `${process.env.FRONTEND_URL || "http://localhost:5173"}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GitHub OAuth callback
authRoutes.get("/github/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    throw badRequest("Missing code parameter");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw badRequest("GitHub OAuth not configured");
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw badRequest("Failed to exchange code for token");
  }

  // Fetch GitHub user
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const ghUser = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url?: string;
  };

  const db = c.var.db;
  const providerUserId = String(ghUser.id);

  // Find or create user
  let user = await findUserByOauth(db, "github", providerUserId);
  if (!user) {
    user = await createUser(db, {
      email: ghUser.email ?? undefined,
      displayName: ghUser.name || ghUser.login,
      avatarUrl: ghUser.avatar_url,
    });
    await createOauthAccount(db, {
      userId: user.id,
      provider: "github",
      providerUserId,
      accessToken: tokenData.access_token,
    });
  }

  await createSessionAndSetCookie(c, db, user.id);

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return c.redirect(`${frontendUrl}/auth/callback`);
});

// Google OAuth callback
authRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    throw badRequest("Missing code parameter");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw badRequest("Google OAuth not configured");
  }

  const redirectUri = `${process.env.FRONTEND_URL || "http://localhost:5173"}/api/auth/google/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw badRequest("Failed to exchange code for token");
  }

  // Fetch Google user info
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const googleUser = (await userRes.json()) as {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  const db = c.var.db;
  const providerUserId = googleUser.id;

  // Find or create user
  let user = await findUserByOauth(db, "google", providerUserId);
  if (!user) {
    user = await createUser(db, {
      email: googleUser.email ?? undefined,
      displayName: googleUser.name || googleUser.email || "Google User",
      avatarUrl: googleUser.picture,
    });
    await createOauthAccount(db, {
      userId: user.id,
      provider: "google",
      providerUserId,
      accessToken: tokenData.access_token,
    });
  }

  await createSessionAndSetCookie(c, db, user.id);

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return c.redirect(`${frontendUrl}/auth/callback`);
});
