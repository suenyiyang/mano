ALTER TABLE "credit_balances" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_transactions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tier_rate_limits" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "credit_balances" CASCADE;--> statement-breakpoint
DROP TABLE "credit_transactions" CASCADE;--> statement-breakpoint
DROP TABLE "payment_history" CASCADE;--> statement-breakpoint
DROP TABLE "subscriptions" CASCADE;--> statement-breakpoint
DROP TABLE "tier_rate_limits" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_stripe_customer_id_unique";--> statement-breakpoint
ALTER TABLE "model_tiers" DROP CONSTRAINT "model_tiers_tier_provider_api_model_id_pk";--> statement-breakpoint
DELETE FROM "model_tiers" a USING "model_tiers" b WHERE a.ctid < b.ctid AND a.provider = b.provider AND a.api_model_id = b.api_model_id;--> statement-breakpoint
ALTER TABLE "model_tiers" ADD CONSTRAINT "model_tiers_provider_api_model_id_pk" PRIMARY KEY("provider","api_model_id");--> statement-breakpoint
ALTER TABLE "auth_sessions" DROP COLUMN "user_tier";--> statement-breakpoint
ALTER TABLE "model_tiers" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "model_tier";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "tier";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "stripe_customer_id";