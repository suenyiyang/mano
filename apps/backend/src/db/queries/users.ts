import { eq } from "drizzle-orm";
import type { Db } from "../index.js";
import { oauthAccounts, users } from "../schema.js";

export const findUserByEmail = async (db: Db, email: string) => {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
};

export const findUserById = async (db: Db, id: string) => {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
};

export const createUser = async (
  db: Db,
  input: { email?: string; passwordHash?: string; displayName: string; avatarUrl?: string },
) => {
  const rows = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    })
    .returning();
  return rows[0]!;
};

export const findOauthAccount = async (db: Db, provider: string, providerUserId: string) => {
  const rows = await db
    .select()
    .from(oauthAccounts)
    .where(eq(oauthAccounts.provider, provider))
    .limit(1);
  // Filter by providerUserId manually since we need compound condition
  return rows.find((r) => r.providerUserId === providerUserId) ?? null;
};

export const createOauthAccount = async (
  db: Db,
  input: {
    userId: string;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
  },
) => {
  const rows = await db.insert(oauthAccounts).values(input).returning();
  return rows[0]!;
};

export const updateUserTier = async (db: Db, userId: string, tier: string) => {
  const rows = await db
    .update(users)
    .set({ tier, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
};

export const updateUserStripeCustomerId = async (
  db: Db,
  userId: string,
  stripeCustomerId: string,
) => {
  const rows = await db
    .update(users)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
};

export const findUserByStripeCustomerId = async (db: Db, stripeCustomerId: string) => {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0] ?? null;
};

export const findUserByOauth = async (db: Db, provider: string, providerUserId: string) => {
  const rows = await db
    .select({ user: users, oauth: oauthAccounts })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(eq(oauthAccounts.provider, provider))
    .limit(10);
  const match = rows.find((r) => r.oauth.providerUserId === providerUserId);
  return match?.user ?? null;
};
