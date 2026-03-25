-- Migration: Add email tracking fields to abandoned_carts
-- Created: 2026-03-25

-- Email tracking columns
ALTER TABLE abandoned_carts
ADD COLUMN IF NOT EXISTS first_email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS second_email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_sent_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS recovered_after_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT FALSE;

-- Index for finding carts that need emails
CREATE INDEX IF NOT EXISTS abandoned_carts_email_pending_idx 
ON abandoned_carts(status, customer_email, first_email_sent_at) 
WHERE status = 'abandoned' AND customer_email IS NOT NULL;
