-- Migration: Email Campaign System
-- Created: 2026-04-03
-- 
-- Adds marketing campaign infrastructure on top of existing email_subscribers table.
-- DOES NOT modify abandoned cart email flow.

-- ============================================================================
-- 1. Add campaign-related fields to email_subscribers
-- ============================================================================

-- Unsubscribe token for one-click unsubscribe links
ALTER TABLE email_subscribers 
ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(64);

-- Suppression tracking (hard bounce, complaint, spam report)
ALTER TABLE email_subscribers 
ADD COLUMN IF NOT EXISTS suppression_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS suppressed_at TIMESTAMPTZ;

-- Activity tracking for segmentation
ALTER TABLE email_subscribers 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_cart_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_campaign_sent_at TIMESTAMPTZ;

-- Generate unsubscribe tokens for existing records
-- Using md5 + random() as fallback since gen_random_bytes may not be available
UPDATE email_subscribers 
SET unsubscribe_token = md5(random()::text || clock_timestamp()::text || id::text)
WHERE unsubscribe_token IS NULL;

-- Index for token lookup
CREATE UNIQUE INDEX IF NOT EXISTS email_subscribers_unsubscribe_token_idx 
ON email_subscribers(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

-- Index for suppressed subscribers
CREATE INDEX IF NOT EXISTS email_subscribers_suppression_idx 
ON email_subscribers(suppression_reason) WHERE suppression_reason IS NOT NULL;

-- Index for activity-based queries
CREATE INDEX IF NOT EXISTS email_subscribers_last_active_idx 
ON email_subscribers(last_active_at);

-- ============================================================================
-- 2. email_campaigns - Campaign definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) NOT NULL, -- tire_promo, wheel_promo, package_promo, newsletter, announcement
    
    -- Status: draft, scheduled, sending, paused, sent, cancelled
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    
    -- Email content
    subject VARCHAR(255) NOT NULL,
    preview_text VARCHAR(255),
    from_name VARCHAR(100),
    reply_to VARCHAR(255),
    
    -- Template system (optional - can use contentJson directly)
    template_key VARCHAR(100),
    content_json JSONB, -- Block-based content structure
    
    -- Audience targeting
    audience_rules_json JSONB NOT NULL DEFAULT '{}',
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ,
    send_mode VARCHAR(20) NOT NULL DEFAULT 'once', -- once, recurring_monthly
    monthly_rule_json JSONB, -- For recurring campaigns
    
    -- Content flags
    include_free_shipping_banner BOOLEAN NOT NULL DEFAULT true,
    include_price_match BOOLEAN NOT NULL DEFAULT true,
    
    -- Tracking
    utm_campaign VARCHAR(100),
    
    -- Stats (denormalized for quick access)
    total_recipients INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    open_count INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    bounce_count INTEGER NOT NULL DEFAULT 0,
    complaint_count INTEGER NOT NULL DEFAULT 0,
    unsubscribe_count INTEGER NOT NULL DEFAULT 0,
    
    -- Test data exclusion
    is_test BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    created_by VARCHAR(100),
    notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS email_campaigns_type_idx ON email_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS email_campaigns_scheduled_idx ON email_campaigns(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS email_campaigns_is_test_idx ON email_campaigns(is_test);

-- ============================================================================
-- 3. email_campaign_recipients - Snapshot of recipients at send time
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES email_subscribers(id) ON DELETE SET NULL,
    
    -- Denormalized email (in case subscriber deleted)
    email VARCHAR(255) NOT NULL,
    
    -- Recipient status: pending, sent, delivered, bounced, complained, failed
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Engagement tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    complained_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    
    -- Email provider reference
    message_id VARCHAR(255),
    
    -- Error info
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate sends
    CONSTRAINT email_campaign_recipients_unique UNIQUE(campaign_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS email_campaign_recipients_campaign_idx 
ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS email_campaign_recipients_status_idx 
ON email_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS email_campaign_recipients_pending_idx 
ON email_campaign_recipients(campaign_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS email_campaign_recipients_email_idx 
ON email_campaign_recipients(email);

-- ============================================================================
-- 4. email_campaign_events - Detailed event log for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES email_campaign_recipients(id) ON DELETE SET NULL,
    
    -- Event type: sent, delivered, opened, clicked, bounced, complained, unsubscribed
    event_type VARCHAR(30) NOT NULL,
    
    -- Event details
    email VARCHAR(255),
    link_url TEXT, -- For click events
    user_agent TEXT,
    ip_address VARCHAR(45),
    
    -- Provider data
    provider_event_id VARCHAR(255),
    raw_data JSONB,
    
    -- Timestamp
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS email_campaign_events_campaign_idx 
ON email_campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS email_campaign_events_type_idx 
ON email_campaign_events(campaign_id, event_type);
CREATE INDEX IF NOT EXISTS email_campaign_events_time_idx 
ON email_campaign_events(occurred_at);
