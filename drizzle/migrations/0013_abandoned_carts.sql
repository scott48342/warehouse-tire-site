-- Migration: Create abandoned_carts table for cart tracking
-- Created: 2026-03-25

CREATE TABLE IF NOT EXISTS abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Cart identifier (generated client-side for recovery links)
    cart_id VARCHAR(64) NOT NULL,
    
    -- Session/user tracking
    session_id VARCHAR(255),
    
    -- Customer info (captured during checkout)
    customer_first_name VARCHAR(100),
    customer_last_name VARCHAR(100),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    
    -- Vehicle info (from cart items)
    vehicle_year VARCHAR(10),
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_trim VARCHAR(255),
    
    -- Cart contents
    items JSONB NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    
    -- Pricing
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    estimated_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Status: active, abandoned, recovered, expired
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Recovery tracking
    recovered_order_id VARCHAR(255),
    recovered_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Abandonment detection
    abandoned_at TIMESTAMPTZ,
    
    -- Source info
    source VARCHAR(50),
    user_agent TEXT,
    ip_address VARCHAR(45)
);

-- Unique cart id index
CREATE UNIQUE INDEX IF NOT EXISTS abandoned_carts_cart_id_idx ON abandoned_carts(cart_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS abandoned_carts_status_idx ON abandoned_carts(status);

-- Customer lookup
CREATE INDEX IF NOT EXISTS abandoned_carts_email_idx ON abandoned_carts(customer_email);

-- Time-based queries
CREATE INDEX IF NOT EXISTS abandoned_carts_last_activity_idx ON abandoned_carts(last_activity_at);
CREATE INDEX IF NOT EXISTS abandoned_carts_created_at_idx ON abandoned_carts(created_at);
