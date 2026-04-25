-- Campaign Discounts
-- Add discount support to email campaigns
-- Created: 2026-04-25

-- Add discount fields to campaigns
ALTER TABLE email_campaigns 
ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS discount_expiry_hours INTEGER DEFAULT 72,
ADD COLUMN IF NOT EXISTS discount_single_use BOOLEAN NOT NULL DEFAULT TRUE;

-- Campaign discounts table - unique codes per recipient
CREATE TABLE IF NOT EXISTS campaign_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
    
    -- Code details
    code VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    
    -- Discount config (copied from campaign at send time)
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    
    -- Timestamps
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Redemption
    redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_at TIMESTAMPTZ,
    redeemed_order_id VARCHAR(100),
    redeemed_amount DECIMAL(10, 2),
    
    -- Tracking
    clicked BOOLEAN NOT NULL DEFAULT FALSE,
    clicked_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS campaign_discounts_campaign_idx ON campaign_discounts(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_discounts_email_idx ON campaign_discounts(email);
CREATE INDEX IF NOT EXISTS campaign_discounts_code_idx ON campaign_discounts(code);
CREATE INDEX IF NOT EXISTS campaign_discounts_expires_idx ON campaign_discounts(expires_at);

-- Add stats columns to campaigns
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS discount_issued_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_redeemed_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0;

COMMENT ON TABLE campaign_discounts IS 'Unique discount codes generated per campaign recipient';
COMMENT ON COLUMN campaign_discounts.code IS 'Unique code like SAVE10-ABCD1234';
