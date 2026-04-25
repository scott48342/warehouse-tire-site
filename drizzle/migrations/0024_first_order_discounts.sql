-- First Order Discounts Table
-- Single-use 10% discount codes for first-time visitors
-- Created: 2026-04-25

CREATE TABLE IF NOT EXISTS first_order_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Unique discount code (e.g., "FIRST-A1B2C3D4")
    code VARCHAR(32) NOT NULL UNIQUE,
    
    -- Email tied to this discount
    email VARCHAR(255) NOT NULL,
    
    -- Discount percentage (default 10%)
    discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    
    -- Timestamps
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Redemption tracking
    redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_at TIMESTAMPTZ,
    redeemed_order_id VARCHAR(100),
    redeemed_amount DECIMAL(10, 2),
    
    -- Email tracking
    email_sent_at TIMESTAMPTZ,
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'popup',  -- popup, manual, api
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS first_order_discounts_email_idx ON first_order_discounts(email);
CREATE INDEX IF NOT EXISTS first_order_discounts_code_idx ON first_order_discounts(code);
CREATE INDEX IF NOT EXISTS first_order_discounts_expires_idx ON first_order_discounts(expires_at);
CREATE INDEX IF NOT EXISTS first_order_discounts_redeemed_idx ON first_order_discounts(redeemed);

-- Comments
COMMENT ON TABLE first_order_discounts IS 'Single-use first-order discount codes for new customers';
COMMENT ON COLUMN first_order_discounts.code IS 'Unique discount code (e.g., FIRST-A1B2C3D4)';
COMMENT ON COLUMN first_order_discounts.email IS 'Email address the discount was issued to';
COMMENT ON COLUMN first_order_discounts.discount_percent IS 'Discount percentage (default 10%)';
COMMENT ON COLUMN first_order_discounts.expires_at IS '48 hours after issue';
COMMENT ON COLUMN first_order_discounts.redeemed IS 'Whether the code has been used';
COMMENT ON COLUMN first_order_discounts.source IS 'How the discount was generated (popup, manual, api)';
