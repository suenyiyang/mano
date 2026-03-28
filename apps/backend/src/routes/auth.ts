import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import {
  createOauthAccount,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByOauth,
} from "../db/queries/users.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
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

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
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

  const tokenPayload = { userId: user.id, email: user.email, tier: user.tier };
  const token = await signAccessToken(tokenPayload);
  const refreshToken = await signRefreshToken(tokenPayload);

  return c.json(
    {
      user: { id: user.id, email: user.email, displayName: user.displayName, tier: user.tier },
      token,
      refreshToken,
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

  const tokenPayload = { userId: user.id, email: user.email, tier: user.tier };
  const token = await signAccessToken(tokenPayload);
  const refreshToken = await signRefreshToken(tokenPayload);

  return c.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, tier: user.tier },
    token,
    refreshToken,
  });
});

authRoutes.post("/refresh", async (c) => {
  const body = refreshSchema.parse(await c.req.json());

  try {
    const payload = await verifyRefreshToken(body.refreshToken);
    const db = c.var.db;
    const user = await findUserById(db, payload.userId);
    if (!user) {
      throw unauthorized("User not found");
    }

    const tokenPayload = { userId: user.id, email: user.email, tier: user.tier };
    const token = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(tokenPayload);

    return c.json({ token, refreshToken });
  } catch {
    throw unauthorized("Invalid or expired refresh token");
  }
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
      tier: user.tier,
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

  const tokenPayload = { userId: user.id, email: user.email, tier: user.tier };
  const token = await signAccessToken(tokenPayload);
  const refreshToken = await signRefreshToken(tokenPayload);

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return c.redirect(`${frontendUrl}/auth/callback?token=${token}&refreshToken=${refreshToken}`);
});
