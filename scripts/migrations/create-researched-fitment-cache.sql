-- Migration: Create researched_fitment_cache table
-- Created: 2026-05-20
-- Purpose: Cache AI-researched fitment data to avoid repeated external lookups

CREATE TABLE IF NOT EXISTS researched_fitment_cache (
    id SERIAL PRIMARY KEY,
    
    -- Vehicle key: year|make|model|trim (normalized lowercase)
    vehicle_key VARCHAR(255) NOT NULL UNIQUE,
    
    -- Parsed components for querying
    year INTEGER NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    trim VARCHAR(100),
    
    -- The researched fitment data (JSON)
    fitment JSONB NOT NULL,
    
    -- Research metadata
    confidence VARCHAR(20) NOT NULL, -- high, medium, low
    sources_used JSONB NOT NULL, -- string[]
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Usage tracking
    use_count INTEGER NOT NULL DEFAULT 1,
    
    -- Status: active, stale, promoted, rejected
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    stale_at TIMESTAMP WITH TIME ZONE, -- When this cache entry becomes stale
    
    -- Admin workflow
    promoted_at TIMESTAMP WITH TIME ZONE,
    promoted_by VARCHAR(100),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejected_by VARCHAR(100),
    rejection_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS rfc_vehicle_key_idx ON researched_fitment_cache(vehicle_key);
CREATE INDEX IF NOT EXISTS rfc_status_idx ON researched_fitment_cache(status);
CREATE INDEX IF NOT EXISTS rfc_ymm_idx ON researched_fitment_cache(year, make, model);
CREATE INDEX IF NOT EXISTS rfc_use_count_idx ON researched_fitment_cache(use_count);
CREATE INDEX IF NOT EXISTS rfc_stale_at_idx ON researched_fitment_cache(stale_at);

-- Comments
COMMENT ON TABLE researched_fitment_cache IS 'Caches AI-researched fitment data to avoid repeated external lookups';
COMMENT ON COLUMN researched_fitment_cache.vehicle_key IS 'Normalized key: year|make|model|trim';
COMMENT ON COLUMN researched_fitment_cache.fitment IS 'Researched fitment JSON: boltPattern, centerBore, trims[], etc';
COMMENT ON COLUMN researched_fitment_cache.confidence IS 'Research confidence: high, medium, low';
COMMENT ON COLUMN researched_fitment_cache.sources_used IS 'Array of source domains used in research';
COMMENT ON COLUMN researched_fitment_cache.status IS 'active, stale, promoted (to curated), rejected';
COMMENT ON COLUMN researched_fitment_cache.stale_at IS 'When cache entry should be considered stale (default: 90 days)';
