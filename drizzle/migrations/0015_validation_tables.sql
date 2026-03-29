-- Migration: 0015_validation_tables
-- Description: Add tables for fitment validation tracking

-- ============================================================================
-- validation_runs - A batch validation run
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Run metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Filter criteria used for this run
    filter_year INTEGER,
    filter_make VARCHAR(100),
    filter_model VARCHAR(100),
    filter_bolt_pattern VARCHAR(20),
    
    -- Status: pending | running | completed | failed
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Aggregate stats
    total_vehicles INTEGER DEFAULT 0,
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    partial_count INTEGER DEFAULT 0,
    
    -- Staggered stats
    staggered_applicable_count INTEGER DEFAULT 0,
    staggered_pass_count INTEGER DEFAULT 0,
    staggered_fail_count INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    -- Error info if run failed
    error_message TEXT,
    
    -- Run configuration
    include_lifted BOOLEAN DEFAULT true,
    concurrency INTEGER DEFAULT 1,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS validation_runs_status_idx ON validation_runs(status);
CREATE INDEX IF NOT EXISTS validation_runs_created_at_idx ON validation_runs(created_at DESC);

-- ============================================================================
-- validation_results - Individual vehicle validation results
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
    
    -- Vehicle identity
    year INTEGER NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    trim VARCHAR(255),
    modification_id VARCHAR(255),
    
    -- Overall result: pass | fail | partial
    status VARCHAR(20) NOT NULL,
    
    -- Standard flow results
    standard_tire_size_count INTEGER DEFAULT 0,
    standard_wheel_count INTEGER DEFAULT 0,
    standard_tire_count INTEGER DEFAULT 0,
    standard_package_count INTEGER DEFAULT 0,
    standard_bolt_pattern VARCHAR(20),
    standard_source VARCHAR(50),
    
    -- Lifted flow results
    lifted_enabled BOOLEAN DEFAULT false,
    lifted_preset_id VARCHAR(20),
    lifted_tire_size_count INTEGER DEFAULT 0,
    lifted_wheel_count INTEGER DEFAULT 0,
    lifted_tire_count INTEGER DEFAULT 0,
    lifted_package_count INTEGER DEFAULT 0,
    
    -- Staggered flow results
    staggered_applicable BOOLEAN DEFAULT false,
    staggered_status VARCHAR(20), -- pass | fail | skipped
    staggered_front_tire_count INTEGER DEFAULT 0,
    staggered_rear_tire_count INTEGER DEFAULT 0,
    staggered_wheel_count INTEGER DEFAULT 0,
    staggered_package_count INTEGER DEFAULT 0,
    staggered_front_size VARCHAR(50),
    staggered_rear_size VARCHAR(50),
    
    -- Failure details
    failure_type VARCHAR(50),
    -- no_tire_sizes | no_wheels | no_tires | no_packages | api_error | 
    -- no_bolt_pattern | lifted_no_profile | lifted_no_wheels | etc.
    failure_reason TEXT,
    
    -- Full diagnostic data
    diagnostics JSONB DEFAULT '{}',
    
    -- Timing
    duration_ms INTEGER,
    tested_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS validation_results_run_id_idx ON validation_results(run_id);
CREATE INDEX IF NOT EXISTS validation_results_status_idx ON validation_results(status);
CREATE INDEX IF NOT EXISTS validation_results_vehicle_idx ON validation_results(year, make, model);
CREATE INDEX IF NOT EXISTS validation_results_failure_type_idx ON validation_results(failure_type);

-- Add comment for documentation
COMMENT ON TABLE validation_runs IS 'Tracks batch validation runs for fitment flow testing';
COMMENT ON TABLE validation_results IS 'Individual vehicle validation results with diagnostics';
