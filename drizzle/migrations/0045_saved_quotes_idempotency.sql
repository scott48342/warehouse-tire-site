-- Migration: Add idempotency_key to saved_quotes
-- Purpose: Database-backed idempotency for serverless concurrency
-- Created: 2026-08-24

-- Add nullable idempotency_key column
ALTER TABLE saved_quotes ADD COLUMN idempotency_key TEXT;

-- Create unique partial index on (user_id, idempotency_key) where key is not null
-- This allows multiple NULL keys (intentional re-saves) while preventing duplicates
CREATE UNIQUE INDEX idx_saved_quotes_idempotency 
  ON saved_quotes(user_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN saved_quotes.idempotency_key IS 
  'Client-provided idempotency key for duplicate request prevention. Unique per user when not null.';
