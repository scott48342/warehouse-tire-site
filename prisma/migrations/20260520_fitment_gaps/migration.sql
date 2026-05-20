-- Fitment Gaps Tracking Tables
-- Created: 2026-05-20
-- Purpose: Track requests for vehicles missing from WTD fitment database

-- ============================================================================
-- Main event log table
-- Captures every fallback fitment request
-- ============================================================================
CREATE TABLE IF NOT EXISTS fitment_gaps (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  trim VARCHAR(100),
  session_id VARCHAR(100),
  conversation_id VARCHAR(100),
  source VARCHAR(50) NOT NULL DEFAULT 'api',  -- jake, api, widget, direct
  action VARCHAR(50) NOT NULL DEFAULT 'lookup', -- lookup, search_tires, search_wheels, cart_created
  
  -- Fallback result details
  fallback_success BOOLEAN NOT NULL DEFAULT false,
  fallback_confidence VARCHAR(20),  -- high, medium, low, unknown
  fallback_source VARCHAR(50),      -- curated_oem, platform_inference, era_common, customer_verify
  has_bolt_pattern BOOLEAN DEFAULT false,
  has_tire_sizes BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for querying
  CONSTRAINT fitment_gaps_year_check CHECK (year >= 1900 AND year <= 2100)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fitment_gaps_vehicle 
  ON fitment_gaps (make, model, year);
CREATE INDEX IF NOT EXISTS idx_fitment_gaps_created 
  ON fitment_gaps (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fitment_gaps_source 
  ON fitment_gaps (source);
CREATE INDEX IF NOT EXISTS idx_fitment_gaps_session 
  ON fitment_gaps (session_id) WHERE session_id IS NOT NULL;

-- ============================================================================
-- Summary table for quick dashboard queries
-- Aggregates by vehicle to avoid expensive COUNT queries
-- ============================================================================
CREATE TABLE IF NOT EXISTS fitment_gap_summary (
  id SERIAL PRIMARY KEY,
  vehicle_key VARCHAR(200) NOT NULL,  -- "Make|Model"
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  
  -- Counters
  request_count INTEGER DEFAULT 1,
  unique_sessions INTEGER DEFAULT 1,
  fallback_success_count INTEGER DEFAULT 0,
  search_attempts INTEGER DEFAULT 0,
  cart_created INTEGER DEFAULT 0,
  
  -- Revenue tracking
  estimated_revenue DECIMAL(10, 2) DEFAULT 0,
  
  -- Timestamps
  first_requested TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_requested TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for upsert
  CONSTRAINT fitment_gap_summary_unique UNIQUE (vehicle_key, year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fitment_gap_summary_requests 
  ON fitment_gap_summary (request_count DESC);
CREATE INDEX IF NOT EXISTS idx_fitment_gap_summary_last 
  ON fitment_gap_summary (last_requested DESC);
CREATE INDEX IF NOT EXISTS idx_fitment_gap_summary_make 
  ON fitment_gap_summary (make);

-- ============================================================================
-- Search tracking table
-- Tracks product searches that used fallback data
-- ============================================================================
CREATE TABLE IF NOT EXISTS fitment_gap_searches (
  id SERIAL PRIMARY KEY,
  vehicle_key VARCHAR(200) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  search_type VARCHAR(20) NOT NULL,  -- tires, wheels
  results_found INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitment_gap_searches_vehicle 
  ON fitment_gap_searches (vehicle_key);

-- ============================================================================
-- Cart tracking table
-- Tracks carts created from fallback flow
-- ============================================================================
CREATE TABLE IF NOT EXISTS fitment_gap_carts (
  id SERIAL PRIMARY KEY,
  vehicle_key VARCHAR(200) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  cart_value DECIMAL(10, 2) NOT NULL,
  item_count INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitment_gap_carts_vehicle 
  ON fitment_gap_carts (vehicle_key);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE fitment_gaps IS 'Raw event log of all fallback fitment requests';
COMMENT ON TABLE fitment_gap_summary IS 'Aggregated stats per vehicle for dashboard queries';
COMMENT ON TABLE fitment_gap_searches IS 'Product searches that used fallback fitment data';
COMMENT ON TABLE fitment_gap_carts IS 'Carts created from fallback flow for revenue tracking';

COMMENT ON COLUMN fitment_gaps.fallback_confidence IS 'Confidence level: high (90%+), medium (70-90%), low (50-70%), unknown (<50%)';
COMMENT ON COLUMN fitment_gaps.fallback_source IS 'Data source: curated_oem, platform_inference, era_common, customer_verify';
