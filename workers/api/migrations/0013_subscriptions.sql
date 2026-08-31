-- Migration: 0013_subscriptions
-- Provider-neutral subscription entitlements. Payment provider writes are disabled
-- until a production billing integration is configured.

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro')) DEFAULT 'free',
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'canceled', 'past_due')) DEFAULT 'active',
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL CHECK (cancel_at_period_end IN (0, 1)) DEFAULT 0,
  provider_customer_id TEXT UNIQUE,
  provider_subscription_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status
  ON user_subscriptions(status, plan);

UPDATE system_metadata
SET value = '0013_subscriptions', updated_at = '2026-09-01T00:00:00.000Z'
WHERE key = 'schema_version';
