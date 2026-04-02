-- Seed model tiers with credit costs in config JSONB
INSERT INTO model_tiers (tier, provider, api_model_id, display_name, weight, is_enabled, config) VALUES
  ('free', 'volcengine', 'doubao-seed-2-0-pro-260215', 'Doubao Seed 2.0 Pro', 1, true, '{"creditsPerMillionInputTokens": 1, "creditsPerMillionOutputTokens": 4}'),
  ('pro', 'volcengine', 'doubao-seed-2-0-pro-260215', 'Doubao Seed 2.0 Pro', 1, true, '{"creditsPerMillionInputTokens": 1, "creditsPerMillionOutputTokens": 4}'),
  ('pro', 'openai', 'gpt-4o', 'GPT-4o', 1, true, '{"creditsPerMillionInputTokens": 3, "creditsPerMillionOutputTokens": 10}'),
  ('pro', 'anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 1, true, '{"creditsPerMillionInputTokens": 3, "creditsPerMillionOutputTokens": 15}'),
  ('max', 'volcengine', 'doubao-seed-2-0-pro-260215', 'Doubao Seed 2.0 Pro', 1, true, '{"creditsPerMillionInputTokens": 1, "creditsPerMillionOutputTokens": 4}'),
  ('max', 'openai', 'gpt-4o', 'GPT-4o', 1, true, '{"creditsPerMillionInputTokens": 3, "creditsPerMillionOutputTokens": 10}'),
  ('max', 'anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 1, true, '{"creditsPerMillionInputTokens": 3, "creditsPerMillionOutputTokens": 15}'),
  ('max', 'openai', 'o3', 'OpenAI o3', 1, true, '{"creditsPerMillionInputTokens": 10, "creditsPerMillionOutputTokens": 40}'),
  ('max', 'anthropic', 'claude-opus-4-20250514', 'Claude Opus 4', 1, true, '{"creditsPerMillionInputTokens": 15, "creditsPerMillionOutputTokens": 75}')
ON CONFLICT (tier, provider, api_model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  config = EXCLUDED.config;
--> statement-breakpoint
-- Seed tier rate limits (per-minute only, credits handle daily limits)
INSERT INTO tier_rate_limits (tier, requests_per_minute, requests_per_day, tokens_per_day) VALUES
  ('free', 5, 1000000, 1000000000),
  ('pro', 20, 1000000, 1000000000),
  ('max', 60, 1000000, 1000000000)
ON CONFLICT (tier) DO UPDATE SET
  requests_per_minute = EXCLUDED.requests_per_minute,
  requests_per_day = EXCLUDED.requests_per_day,
  tokens_per_day = EXCLUDED.tokens_per_day;
--> statement-breakpoint
-- Migrate legacy 'mini' tier to 'free'
UPDATE users SET tier = 'free' WHERE tier = 'mini';
--> statement-breakpoint
UPDATE auth_sessions SET user_tier = 'free' WHERE user_tier = 'mini';
--> statement-breakpoint
-- Change column default from 'mini' to 'free'
ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'free';
--> statement-breakpoint
-- Initialize credit balances for existing users (free tier = 1000 credits)
INSERT INTO credit_balances (user_id, balance, monthly_allowance, period_start, period_end)
SELECT id, 1000, 1000, now(), now() + interval '30 days'
FROM users
WHERE id NOT IN (SELECT user_id FROM credit_balances);
