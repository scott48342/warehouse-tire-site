-- Fitment API Access Management Tables
-- Created: 2026-04-02

-- ============================================================================
-- api_access_requests - Pending API access requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Applicant info
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    
    -- Use case
    use_case VARCHAR(50) NOT NULL,
    use_case_details TEXT,
    expected_usage VARCHAR(50),
    
    -- Status: pending, approved, rejected
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Review
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- Associated API key (set on approval)
    api_key_id UUID,
    
    -- Email tracking
    confirmation_email_sent_at TIMESTAMP,
    approval_email_sent_at TIMESTAMP,
    follow_up_email_sent_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_access_requests_email_idx ON api_access_requests(email);
CREATE INDEX IF NOT EXISTS api_access_requests_status_idx ON api_access_requests(status);
CREATE INDEX IF NOT EXISTS api_access_requests_created_at_idx ON api_access_requests(created_at);

-- ============================================================================
-- api_keys - Active API keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Key identity (store hash, not plain key)
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,
    
    -- Owner info
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    
    -- Plan/tier
    plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    
    -- Rate limits
    monthly_limit INTEGER NOT NULL DEFAULT 10000,
    daily_limit INTEGER,
    
    -- Usage tracking
    request_count INTEGER NOT NULL DEFAULT 0,
    last_request_at TIMESTAMP,
    monthly_request_count INTEGER NOT NULL DEFAULT 0,
    monthly_reset_at TIMESTAMP,
    
    -- First call tracking (for follow-up email)
    first_call_at TIMESTAMP,
    first_call_endpoint VARCHAR(255),
    
    -- Status
    active BOOLEAN NOT NULL DEFAULT TRUE,
    suspended_at TIMESTAMP,
    suspend_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS api_keys_email_idx ON api_keys(email);
CREATE INDEX IF NOT EXISTS api_keys_active_idx ON api_keys(active);

-- Add foreign key constraint
ALTER TABLE api_access_requests 
    ADD CONSTRAINT fk_api_access_requests_api_key 
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL;

-- ============================================================================
-- api_usage_logs - Request logs for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Request info
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    
    -- Request params (for debugging)
    query_params TEXT,
    
    -- Client info
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_usage_logs_api_key_id_idx ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS api_usage_logs_created_at_idx ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS api_usage_logs_endpoint_idx ON api_usage_logs(endpoint);
