-- Missing Fitment Request Tracking Tables
-- Created: 2026-05-20
-- Purpose: Track and manage vehicles missing from WTD fitment database

-- ============================================================================
-- Main tracking table for missing fitment requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS missing_fitment_requests (
  id SERIAL PRIMARY KEY,
  
  -- Vehicle identification (unique key)
  vehicle_key VARCHAR(200) NOT NULL UNIQUE,  -- "year|make|model|trim" lowercase
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  trim VARCHAR(100),
  raw_customer_text TEXT,
  normalized_vehicle VARCHAR(200) NOT NULL,  -- "2009 Cadillac DTS"
  
  -- Source context
  source VARCHAR(50) NOT NULL DEFAULT 'jake',  -- jake, jake_garage, local, national, api, widget
  session_id VARCHAR(100),
  request_id VARCHAR(100),
  conversation_url VARCHAR(500),
  hostname VARCHAR(100),
  
  -- Fallback information
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  fallback_confidence VARCHAR(20),  -- high, medium, low, unknown
  fallback_tire_size VARCHAR(50),
  fallback_bolt_pattern VARCHAR(20),
  
  -- Outcome tracking
  cart_created BOOLEAN NOT NULL DEFAULT false,
  checkout_started BOOLEAN NOT NULL DEFAULT false,
  order_completed BOOLEAN DEFAULT false,
  order_value DECIMAL(10, 2),
  
  -- Management
  status VARCHAR(20) NOT NULL DEFAULT 'new',  -- new, reviewed, added_to_db, ignored
  request_count INTEGER NOT NULL DEFAULT 1,
  last_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT missing_fitment_year_check CHECK (year >= 1900 AND year <= 2100),
  CONSTRAINT missing_fitment_status_check CHECK (status IN ('new', 'reviewed', 'added_to_db', 'ignored'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_missing_fitment_status 
  ON missing_fitment_requests (status);
CREATE INDEX IF NOT EXISTS idx_missing_fitment_request_count 
  ON missing_fitment_requests (request_count DESC);
CREATE INDEX IF NOT EXISTS idx_missing_fitment_last_requested 
  ON missing_fitment_requests (last_requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_missing_fitment_created 
  ON missing_fitment_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missing_fitment_session 
  ON missing_fitment_requests (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_missing_fitment_make 
  ON missing_fitment_requests (make);
CREATE INDEX IF NOT EXISTS idx_missing_fitment_cart 
  ON missing_fitment_requests (cart_created) WHERE cart_created = true;
CREATE INDEX IF NOT EXISTS idx_missing_fitment_checkout 
  ON missing_fitment_requests (checkout_started) WHERE checkout_started = true;

-- ============================================================================
-- Alerts table for admin notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS missing_fitment_alerts (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,  -- new_vehicle, repeat_request, cart_created, checkout_started
  vehicle_key VARCHAR(200) NOT NULL,
  normalized_vehicle VARCHAR(200) NOT NULL,
  request_count INTEGER DEFAULT 1,
  message TEXT NOT NULL,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missing_fitment_alerts_dismissed 
  ON missing_fitment_alerts (dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missing_fitment_alerts_type 
  ON missing_fitment_alerts (type);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE missing_fitment_requests IS 'Tracks vehicles missing from WTD fitment database. Supports upsert on vehicle_key.';
COMMENT ON TABLE missing_fitment_alerts IS 'Admin alerts for missing fitment events (new vehicle, repeat requests, cart/checkout)';

COMMENT ON COLUMN missing_fitment_requests.vehicle_key IS 'Unique key: year|make|model|trim (lowercase)';
COMMENT ON COLUMN missing_fitment_requests.fallback_confidence IS 'Confidence level: high, medium, low, unknown';
COMMENT ON COLUMN missing_fitment_requests.status IS 'Workflow status: new → reviewed → added_to_db or ignored';
COMMENT ON COLUMN missing_fitment_requests.request_count IS 'Number of times this vehicle has been requested';
