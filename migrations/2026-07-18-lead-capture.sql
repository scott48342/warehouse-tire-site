-- Lead Capture & Abandoned Build Tables
-- Created: 2026-07-18
-- Purpose: Unified lead tracking across all WTD properties

-- ============================================================================
-- LEADS TABLE
-- Master lead table for capturing email/vehicle/cart data before abandonment
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact info
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Vehicle info
  vehicle_year VARCHAR(10),
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(200),
  vehicle_trim VARCHAR(200),
  
  -- Source tracking
  source_site VARCHAR(50) NOT NULL, -- national, local, garage
  source_channel VARCHAR(50) NOT NULL, -- cart_save, checkout, build_save, jake_package, exit_intent
  session_id VARCHAR(100),
  
  -- Cart/Build linkage
  cart_id VARCHAR(100),
  jake_build_id UUID,
  cart_value DECIMAL(10, 2),
  
  -- Shopping context
  tire_size VARCHAR(50),
  wheel_size VARCHAR(50),
  lift_level VARCHAR(50),
  build_profile VARCHAR(100),
  
  -- Cart snapshot
  cart_snapshot JSONB,
  checkout_url TEXT,
  
  -- Consent
  marketing_consent BOOLEAN NOT NULL DEFAULT true,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'new', -- new, contacted, converted, expired
  converted_order_id VARCHAR(100),
  converted_at TIMESTAMP WITH TIME ZONE,
  
  -- Recovery emails
  first_email_at TIMESTAMP WITH TIME ZONE,
  second_email_at TIMESTAMP WITH TIME ZONE,
  third_email_at TIMESTAMP WITH TIME ZONE,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  last_email_opened_at TIMESTAMP WITH TIME ZONE,
  last_email_clicked_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  user_agent TEXT,
  ip_address VARCHAR(45),
  referrer TEXT,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Test data
  is_test BOOLEAN NOT NULL DEFAULT false,
  test_reason VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for leads table
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(email);
CREATE INDEX IF NOT EXISTS leads_source_site_idx ON leads(source_site);
CREATE INDEX IF NOT EXISTS leads_source_channel_idx ON leads(source_channel);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_cart_id_idx ON leads(cart_id);
CREATE INDEX IF NOT EXISTS leads_is_test_idx ON leads(is_test);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at);
CREATE INDEX IF NOT EXISTS leads_source_combined_idx ON leads(source_site, source_channel);

-- ============================================================================
-- JAKE_BUILDS TABLE
-- Track Jake Garage conversations and build recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS jake_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session identity
  conversation_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100),
  
  -- Vehicle info
  vehicle_year VARCHAR(10),
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(200),
  vehicle_trim VARCHAR(200),
  
  -- Build details
  build_style VARCHAR(50), -- stock, leveled, lifted, performance
  tire_size VARCHAR(50),
  wheel_diameter INTEGER,
  wheel_width DECIMAL(4, 1),
  lift_height VARCHAR(50),
  
  -- Recommendations shown
  recommended_wheels JSONB,
  recommended_tires JSONB,
  recommended_package_value DECIMAL(10, 2),
  
  -- Conversation summary
  message_count INTEGER NOT NULL DEFAULT 0,
  conversation_summary TEXT,
  last_user_message TEXT,
  tools_used JSONB,
  
  -- Lead linkage
  lead_id UUID REFERENCES leads(id),
  email VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, cart_created, abandoned, converted
  cart_id VARCHAR(100),
  order_id VARCHAR(100),
  
  -- Source site
  source_site VARCHAR(50) NOT NULL DEFAULT 'garage',
  
  -- Test data
  is_test BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  abandoned_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for jake_builds table
CREATE INDEX IF NOT EXISTS jake_builds_conversation_id_idx ON jake_builds(conversation_id);
CREATE INDEX IF NOT EXISTS jake_builds_email_idx ON jake_builds(email);
CREATE INDEX IF NOT EXISTS jake_builds_lead_id_idx ON jake_builds(lead_id);
CREATE INDEX IF NOT EXISTS jake_builds_status_idx ON jake_builds(status);
CREATE INDEX IF NOT EXISTS jake_builds_source_site_idx ON jake_builds(source_site);
CREATE INDEX IF NOT EXISTS jake_builds_is_test_idx ON jake_builds(is_test);
CREATE INDEX IF NOT EXISTS jake_builds_created_at_idx ON jake_builds(created_at);

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Lead source summary view
CREATE OR REPLACE VIEW lead_source_stats AS
SELECT
  source_site,
  source_channel,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE status = 'converted') AS converted_leads,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'converted') / NULLIF(COUNT(*), 0), 2) AS conversion_rate,
  COALESCE(SUM(cart_value), 0) AS total_value,
  COALESCE(ROUND(AVG(cart_value), 2), 0) AS average_value
FROM leads
WHERE is_test = false
GROUP BY source_site, source_channel
ORDER BY total_leads DESC;

-- Daily lead capture view
CREATE OR REPLACE VIEW daily_lead_stats AS
SELECT
  DATE(created_at) AS date,
  source_site,
  COUNT(*) AS leads_captured,
  COUNT(*) FILTER (WHERE status = 'converted') AS conversions,
  COALESCE(SUM(cart_value) FILTER (WHERE status = 'converted'), 0) AS revenue
FROM leads
WHERE is_test = false
GROUP BY DATE(created_at), source_site
ORDER BY date DESC;

-- Jake build summary view
CREATE OR REPLACE VIEW jake_build_stats AS
SELECT
  source_site,
  build_style,
  COUNT(*) AS total_builds,
  COUNT(*) FILTER (WHERE status = 'cart_created') AS added_to_cart,
  COUNT(*) FILTER (WHERE status = 'converted') AS converted,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS leads_captured,
  COALESCE(AVG(recommended_package_value), 0) AS avg_package_value
FROM jake_builds
WHERE is_test = false
GROUP BY source_site, build_style
ORDER BY total_builds DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE leads IS 'Unified lead capture across all WTD properties (national, local, garage)';
COMMENT ON TABLE jake_builds IS 'Jake Garage conversation and build tracking for abandoned build recovery';

COMMENT ON COLUMN leads.source_site IS 'national = shop.warehousetiredirect.com, local = shop.warehousetire.net, garage = /garage route';
COMMENT ON COLUMN leads.source_channel IS 'cart_save = Save My Cart modal, checkout = email at checkout, build_save = Jake build save, jake_package = package recommendation, exit_intent = exit intent popup';

-- ============================================================================
-- FUNNEL EVENTS TABLE
-- Aggregated daily funnel event tracking for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS funnel_events_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  source_site VARCHAR(50) NOT NULL DEFAULT 'unknown',
  source_channel VARCHAR(50) NOT NULL DEFAULT 'unknown',
  event_count INTEGER NOT NULL DEFAULT 0,
  total_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE (date, event_type, source_site, source_channel)
);

-- Indexes for funnel_events_daily
CREATE INDEX IF NOT EXISTS funnel_events_daily_date_idx ON funnel_events_daily(date);
CREATE INDEX IF NOT EXISTS funnel_events_daily_event_type_idx ON funnel_events_daily(event_type);
CREATE INDEX IF NOT EXISTS funnel_events_daily_source_idx ON funnel_events_daily(source_site, source_channel);

-- Funnel conversion view
CREATE OR REPLACE VIEW funnel_conversion_rates AS
SELECT
  source_site,
  SUM(event_count) FILTER (WHERE event_type = 'save_modal_shown') AS modals_shown,
  SUM(event_count) FILTER (WHERE event_type = 'save_modal_submitted') AS modals_submitted,
  SUM(event_count) FILTER (WHERE event_type = 'save_modal_skipped') AS modals_skipped,
  SUM(event_count) FILTER (WHERE event_type = 'lead_created') AS leads_created,
  SUM(event_count) FILTER (WHERE event_type = 'checkout_started') AS checkouts_started,
  SUM(event_count) FILTER (WHERE event_type = 'checkout_completed') AS checkouts_completed,
  ROUND(
    100.0 * SUM(event_count) FILTER (WHERE event_type = 'save_modal_submitted') / 
    NULLIF(SUM(event_count) FILTER (WHERE event_type = 'save_modal_shown'), 0),
    2
  ) AS modal_submit_rate,
  ROUND(
    100.0 * SUM(event_count) FILTER (WHERE event_type = 'checkout_completed') / 
    NULLIF(SUM(event_count) FILTER (WHERE event_type = 'lead_created'), 0),
    2
  ) AS lead_to_checkout_rate
FROM funnel_events_daily
WHERE date >= CURRENT_DATE - 30
GROUP BY source_site
ORDER BY leads_created DESC;

COMMENT ON TABLE funnel_events_daily IS 'Aggregated daily funnel events for lead capture analytics';
