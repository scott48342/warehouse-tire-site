-- Conversion Funnel Events Table
-- Tracks all funnel events for analytics

CREATE TABLE IF NOT EXISTS funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  event_name VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100),
  
  -- Segmentation
  traffic_source VARCHAR(100),      -- google, direct, facebook, etc.
  device_type VARCHAR(50),          -- mobile, desktop, tablet
  store_mode VARCHAR(20),           -- local, national
  
  -- Event data
  page_url TEXT,
  product_sku VARCHAR(100),
  product_type VARCHAR(50),         -- wheel, tire, accessory, package
  cart_value DECIMAL(10,2),
  order_id VARCHAR(100),
  coupon_code VARCHAR(50),
  
  -- Metadata
  user_agent TEXT,
  ip_address VARCHAR(50),
  referrer TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Extra JSON data
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_name ON funnel_events(event_name);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session_id ON funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON funnel_events(created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_store_mode ON funnel_events(store_mode);
CREATE INDEX IF NOT EXISTS idx_funnel_events_device_type ON funnel_events(device_type);
CREATE INDEX IF NOT EXISTS idx_funnel_events_traffic_source ON funnel_events(traffic_source);

-- Composite index for funnel queries
CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel_query 
ON funnel_events(event_name, created_at, store_mode, device_type);
