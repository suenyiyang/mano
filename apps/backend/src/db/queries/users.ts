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
