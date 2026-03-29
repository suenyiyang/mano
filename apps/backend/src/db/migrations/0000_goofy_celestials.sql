CREATE TABLE "active_generations" (
	"response_id" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"transport" text NOT NULL,
	"command" text,
	"args" jsonb,
	"url" text,
	"env" jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_servers_user_name" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"tool_calls" jsonb,
	"tool_call_id" text,
	"tool_name" text,
	"ordinal" integer NOT NULL,
	"model_id" text,
	"response_id" text,
	"token_usage" jsonb,
	"is_compacted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_session_ordinal" UNIQUE("session_id","ordinal")
);
--> statement-breakpoint
CREATE TABLE "model_tiers" (
	"tier" text NOT NULL,
	"provider" text NOT NULL,
	"api_model_id" text NOT NULL,
	"display_name" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "model_tiers_tier_provider_api_model_id_pk" PRIMARY KEY("tier","provider","api_model_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_provider_user" UNIQUE("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_minute_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"requests_used" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_usage_user_date" UNIQUE("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"system_prompt" text DEFAULT '' NOT NULL,
	"model_tier" text DEFAULT 'pro' NOT NULL,
	"forked_from_session_id" uuid,
	"forked_at_message_id" uuid,
	"compact_summary" text,
	"compact_after_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"resources" jsonb DEFAULT '[]'::jsonb,
	"scripts" jsonb DEFAULT '[]'::jsonb,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_user_name" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "sse_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"response_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tier_rate_limits" (
	"tier" text PRIMARY KEY NOT NULL,
	"requests_per_minute" integer NOT NULL,
	"requests_per_day" integer NOT NULL,
	"tokens_per_day" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"password_hash" text,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"tier" text DEFAULT 'mini' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "active_generations" ADD CONSTRAINT "active_generations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_minute_log" ADD CONSTRAINT "rate_limit_minute_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_limit_usage" ADD CONSTRAINT "rate_limit_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sse_events" ADD CONSTRAINT "sse_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_active_gen_session" ON "active_generations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_message" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_messages_session" ON "messages" USING btree ("session_id","ordinal");--> statement-breakpoint
CREATE INDEX "idx_messages_response" ON "messages" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_user" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_minute" ON "rate_limit_minute_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_rate_limit_user_date" ON "rate_limit_usage" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_sse_response" ON "sse_events" USING btree ("response_id","id");