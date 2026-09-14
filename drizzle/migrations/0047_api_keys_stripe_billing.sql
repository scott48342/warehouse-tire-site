-- Fitment API self-serve billing: link api_keys to Stripe subscriptions
-- Created: 2026-09-14
--
-- Adds Stripe customer/subscription references and a subscription status
-- (active / past_due / canceled) so the Stripe webhook can create keys on
-- checkout.session.completed and deactivate them on cancellation.
-- Idempotent: safe to re-run.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(64);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(64);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32);

CREATE INDEX IF NOT EXISTS api_keys_stripe_customer_id_idx
  ON api_keys (stripe_customer_id);

-- One key per subscription (webhook idempotency). Partial unique: NULLs allowed
-- for manually-approved keys that have no Stripe subscription.
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_stripe_subscription_id_idx
  ON api_keys (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
