-- Migration: Create cart_add_events table for product popularity tracking
-- Created: 2026-04-05
-- 
-- Tracks every add-to-cart event for business analytics:
-- - Product popularity (tires vs wheels)
-- - Conversion from add-to-cart to purchase
-- - Source/context tracking (PDP, package, etc.)

CREATE TABLE IF NOT EXISTS cart_add_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Product identification
    product_type VARCHAR(20) NOT NULL,  -- 'tire' or 'wheel'
    sku VARCHAR(100) NOT NULL,
    rear_sku VARCHAR(100),              -- For staggered setups
    
    -- Product details (captured at time of add)
    product_name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    price_at_time DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- Product specs (for filtering/grouping)
    size VARCHAR(100),                  -- Tire size or wheel diameter
    specs JSONB,                        -- Additional specs (width, offset, etc.)
    
    -- Cart/session tracking
    cart_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(255),
    
    -- Vehicle context (if available)
    vehicle_year VARCHAR(10),
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_trim VARCHAR(255),
    
    -- Source/context
    source VARCHAR(50),                 -- pdp, package, search, etc.
    referrer TEXT,
    
    -- Purchase tracking (updated when order completes)
    purchased BOOLEAN NOT NULL DEFAULT FALSE,
    order_id VARCHAR(50),
    purchased_at TIMESTAMPTZ,
    
    -- Test data exclusion
    is_test BOOLEAN NOT NULL DEFAULT FALSE,
    test_reason VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Request metadata
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Fast lookups by product type and SKU
CREATE INDEX IF NOT EXISTS cart_add_events_type_sku_idx 
    ON cart_add_events(product_type, sku);

-- Time-based queries for recent activity
CREATE INDEX IF NOT EXISTS cart_add_events_created_at_idx 
    ON cart_add_events(created_at DESC);

-- Exclude test data in queries
CREATE INDEX IF NOT EXISTS cart_add_events_is_test_idx 
    ON cart_add_events(is_test);

-- Cart ID for linking events to purchases
CREATE INDEX IF NOT EXISTS cart_add_events_cart_id_idx 
    ON cart_add_events(cart_id);

-- Brand analytics
CREATE INDEX IF NOT EXISTS cart_add_events_brand_idx 
    ON cart_add_events(product_type, brand);

-- Purchase tracking
CREATE INDEX IF NOT EXISTS cart_add_events_purchased_idx 
    ON cart_add_events(purchased, product_type);

-- Compound index for main reporting query (non-test, by type)
CREATE INDEX IF NOT EXISTS cart_add_events_report_idx 
    ON cart_add_events(product_type, is_test, created_at DESC);
