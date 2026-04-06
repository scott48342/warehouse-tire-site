-- Migration: Create competitor_page_analysis table
-- Created: 2026-04-06
-- 
-- Internal tool for comparing our SRP/PDP pages against competitors
-- Stores URLs, scores, and insights for optimization

CREATE TABLE IF NOT EXISTS competitor_page_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Page identification
    page_type VARCHAR(10) NOT NULL CHECK (page_type IN ('srp', 'pdp')),
    our_url TEXT NOT NULL,
    competitor_name VARCHAR(100) NOT NULL,
    competitor_url TEXT NOT NULL,
    
    -- Context (optional)
    vehicle_context JSONB, -- {year, make, model, trim}
    product_context JSONB, -- {sku, brand, productName}
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- SRP Scoring Fields (0-10 scale, NULL if page_type != 'srp')
    -- ═══════════════════════════════════════════════════════════════════════════
    srp_image_quality_score SMALLINT CHECK (srp_image_quality_score BETWEEN 0 AND 10),
    srp_pricing_clarity_score SMALLINT CHECK (srp_pricing_clarity_score BETWEEN 0 AND 10),
    srp_trust_signal_score SMALLINT CHECK (srp_trust_signal_score BETWEEN 0 AND 10),
    srp_filter_usability_score SMALLINT CHECK (srp_filter_usability_score BETWEEN 0 AND 10),
    srp_merchandising_score SMALLINT CHECK (srp_merchandising_score BETWEEN 0 AND 10),
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- PDP Scoring Fields (0-10 scale, NULL if page_type != 'pdp')
    -- ═══════════════════════════════════════════════════════════════════════════
    pdp_above_fold_clarity_score SMALLINT CHECK (pdp_above_fold_clarity_score BETWEEN 0 AND 10),
    pdp_image_experience_score SMALLINT CHECK (pdp_image_experience_score BETWEEN 0 AND 10),
    pdp_product_info_score SMALLINT CHECK (pdp_product_info_score BETWEEN 0 AND 10),
    pdp_trust_layer_score SMALLINT CHECK (pdp_trust_layer_score BETWEEN 0 AND 10),
    pdp_conversion_driver_score SMALLINT CHECK (pdp_conversion_driver_score BETWEEN 0 AND 10),
    pdp_cta_strength_score SMALLINT CHECK (pdp_cta_strength_score BETWEEN 0 AND 10),
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- Our Page Scores (for comparison)
    -- ═══════════════════════════════════════════════════════════════════════════
    our_srp_image_quality_score SMALLINT CHECK (our_srp_image_quality_score BETWEEN 0 AND 10),
    our_srp_pricing_clarity_score SMALLINT CHECK (our_srp_pricing_clarity_score BETWEEN 0 AND 10),
    our_srp_trust_signal_score SMALLINT CHECK (our_srp_trust_signal_score BETWEEN 0 AND 10),
    our_srp_filter_usability_score SMALLINT CHECK (our_srp_filter_usability_score BETWEEN 0 AND 10),
    our_srp_merchandising_score SMALLINT CHECK (our_srp_merchandising_score BETWEEN 0 AND 10),
    
    our_pdp_above_fold_clarity_score SMALLINT CHECK (our_pdp_above_fold_clarity_score BETWEEN 0 AND 10),
    our_pdp_image_experience_score SMALLINT CHECK (our_pdp_image_experience_score BETWEEN 0 AND 10),
    our_pdp_product_info_score SMALLINT CHECK (our_pdp_product_info_score BETWEEN 0 AND 10),
    our_pdp_trust_layer_score SMALLINT CHECK (our_pdp_trust_layer_score BETWEEN 0 AND 10),
    our_pdp_conversion_driver_score SMALLINT CHECK (our_pdp_conversion_driver_score BETWEEN 0 AND 10),
    our_pdp_cta_strength_score SMALLINT CHECK (our_pdp_cta_strength_score BETWEEN 0 AND 10),
    
    -- ═══════════════════════════════════════════════════════════════════════════
    -- Meta / Notes
    -- ═══════════════════════════════════════════════════════════════════════════
    notes TEXT,
    strengths TEXT,
    weaknesses TEXT,
    opportunities TEXT,
    
    -- Page metadata (fetched automatically, optional)
    competitor_title TEXT,
    competitor_meta_description TEXT,
    our_title TEXT,
    our_meta_description TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing/filtering
CREATE INDEX IF NOT EXISTS competitor_page_analysis_page_type_idx 
    ON competitor_page_analysis(page_type);

CREATE INDEX IF NOT EXISTS competitor_page_analysis_competitor_idx 
    ON competitor_page_analysis(competitor_name);

CREATE INDEX IF NOT EXISTS competitor_page_analysis_status_idx 
    ON competitor_page_analysis(status);

CREATE INDEX IF NOT EXISTS competitor_page_analysis_created_idx 
    ON competitor_page_analysis(created_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_competitor_analysis_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS competitor_page_analysis_updated_at ON competitor_page_analysis;
CREATE TRIGGER competitor_page_analysis_updated_at
    BEFORE UPDATE ON competitor_page_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_competitor_analysis_timestamp();
