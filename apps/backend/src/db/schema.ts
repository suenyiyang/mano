import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  tier: text().notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── OAuth Accounts ─────────────────────────────────────────────────────────

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    providerUserId: text("provider_user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("oauth_provider_user").on(t.provider, t.providerUserId),
    index("idx_oauth_user").on(t.userId),
  ],
);

// ─── Auth Sessions ─────────────────────────────────────────────────────────

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userTier: text("user_tier").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_auth_sessions_user").on(t.userId)],
);

// ─── Sessions ───────────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text(),
    systemPrompt: text("system_prompt").notNull().default(""),
    modelTier: text("model_tier").notNull().default("pro"),
    forkedFromSessionId: uuid("forked_from_session_id"),
    forkedAtMessageId: uuid("forked_at_message_id"),
    compactSummary: text("compact_summary"),
    compactAfterMessageId: uuid("compact_after_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_user").on(t.userId, t.updatedAt)],
);

// ─── Messages ───────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text().notNull(),
    content: jsonb().notNull(),
    toolCalls: jsonb("tool_calls"),
    toolCallId: text("tool_call_id"),
    toolName: text("tool_name"),
    ordinal: integer().notNull(),
    modelId: text("model_id"),
    responseId: text("response_id"),
    tokenUsage: jsonb("token_usage"),
    isCompacted: boolean("is_compacted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("messages_session_ordinal").on(t.sessionId, t.ordinal),
    index("idx_messages_session").on(t.sessionId, t.ordinal),
    index("idx_messages_response").on(t.responseId),
  ],
);

// ─── SSE Events (ephemeral, for resume) ─────────────────────────────────────

export const sseEvents = pgTable(
  "sse_events",
  {
    id: serial().primaryKey(),
    responseId: text("response_id").notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    data: jsonb().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sse_response").on(t.responseId, t.id)],
);

// ─── Active Generations ─────────────────────────────────────────────────────

export const activeGenerations = pgTable(
  "active_generations",
  {
    responseId: text("response_id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    status: text().notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("idx_active_gen_session").on(t.sessionId)],
);

// ─── Attachments ────────────────────────────────────────────────────────────

export const attachments = pgTable(
  "attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    filename: text().notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_attachments_message").on(t.messageId)],
);

// ─── Skills ─────────────────────────────────────────────────────────────────

export const skills = pgTable(
  "skills",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    displayName: text("display_name").notNull(),
    description: text().notNull().default(""),
    content: text().notNull(),
    resources: jsonb().default([]),
    scripts: jsonb().default([]),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("skills_user_name").on(t.userId, t.name)],
);

// ─── MCP Servers ────────────────────────────────────────────────────────────

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    transport: text().notNull(),
    command: text(),
    args: jsonb(),
    url: text(),
    env: jsonb(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("mcp_servers_user_name").on(t.userId, t.name)],
);

// ─── Model Tiers ────────────────────────────────────────────────────────────

export const modelTiers = pgTable(
  "model_tiers",
  {
    tier: text().notNull(),
    provider: text().notNull(),
    apiModelId: text("api_model_id").notNull(),
    displayName: text("display_name").notNull(),
    weight: integer().notNull().default(1),
    isEnabled: boolean("is_enabled").notNull().default(true),
    config: jsonb().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.tier, t.provider, t.apiModelId] })],
);

// ─── Tier Rate Limits ───────────────────────────────────────────────────────

export const tierRateLimits = pgTable("tier_rate_limits", {
  tier: text().primaryKey(),
  requestsPerMinute: integer("requests_per_minute").notNull(),
  requestsPerDay: integer("requests_per_day").notNull(),
  tokensPerDay: integer("tokens_per_day").notNull(),
});

// ─── Rate Limit Usage Tracking ─────────────────────────────────────────────

export const rateLimitUsage = pgTable(
  "rate_limit_usage",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text().notNull(), // YYYY-MM-DD
    requestsUsed: integer("requests_used").notNull().default(0),
    tokensUsed: integer("tokens_used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("rate_limit_usage_user_date").on(t.userId, t.date),
    index("idx_rate_limit_user_date").on(t.userId, t.date),
  ],
);

// ─── Rate Limit Minute Window ──────────────────────────────────────────────

export const rateLimitMinuteLog = pgTable(
  "rate_limit_minute_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_rate_limit_minute").on(t.userId, t.createdAt)],
);
