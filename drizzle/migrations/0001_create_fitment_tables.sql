-- Fitment Database Schema
-- Migration: 0001_create_fitment_tables
-- 
-- Tables:
-- - fitment_source_records: Raw API responses for debugging
-- - vehicle_fitments: Normalized fitment data for runtime
-- - fitment_overrides: Manual corrections
-- - fitment_import_jobs: Batch import tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- fitment_source_records - Raw API responses stored unchanged
-- ============================================================================

CREATE TABLE IF NOT EXISTS fitment_source_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  raw_payload JSONB NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64) NOT NULL
);

-- Unique constraint: one record per source + source_id
CREATE UNIQUE INDEX IF NOT EXISTS fitment_source_records_source_source_id_idx 
  ON fitment_source_records (source, source_id);

-- Lookup by vehicle
CREATE INDEX IF NOT EXISTS fitment_source_records_vehicle_idx 
  ON fitment_source_records (year, make, model);

-- ============================================================================
-- vehicle_fitments - Normalized fitment data for runtime use
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_fitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Canonical identity
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  modification_id VARCHAR(255) NOT NULL,
  
  -- Trim/submodel display
  raw_trim VARCHAR(255),
  display_trim VARCHAR(255) NOT NULL,
  submodel VARCHAR(255),
  
  -- Wheel specifications
  bolt_pattern VARCHAR(20),
  center_bore_mm DECIMAL(5, 1),
  thread_size VARCHAR(20),
  seat_type VARCHAR(20),
  
  -- Offset range
  offset_min_mm INTEGER,
  offset_max_mm INTEGER,
  
  -- OEM sizes (JSON arrays)
  oem_wheel_sizes JSONB NOT NULL DEFAULT '[]',
  oem_tire_sizes JSONB NOT NULL DEFAULT '[]',
  
  -- Source tracking
  source VARCHAR(50) NOT NULL,
  source_record_id UUID REFERENCES fitment_source_records(id),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMP
);

-- Primary lookup: year + make + model + modification
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_fitments_canonical_idx 
  ON vehicle_fitments (year, make, model, modification_id);

-- Fast lookups by vehicle
CREATE INDEX IF NOT EXISTS vehicle_fitments_ymm_idx 
  ON vehicle_fitments (year, make, model);

-- Lookup by make/model (for browsing)
CREATE INDEX IF NOT EXISTS vehicle_fitments_make_model_idx 
  ON vehicle_fitments (make, model);

-- ============================================================================
-- fitment_overrides - Manual corrections to source data
-- ============================================================================

CREATE TABLE IF NOT EXISTS fitment_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Scope: how specific is this override?
  scope VARCHAR(20) NOT NULL,
  
  -- Match criteria (null = wildcard)
  year INTEGER,
  make VARCHAR(100),
  model VARCHAR(100),
  modification_id VARCHAR(255),
  
  -- Override values (null = don't override)
  display_trim VARCHAR(255),
  bolt_pattern VARCHAR(20),
  center_bore_mm DECIMAL(5, 1),
  thread_size VARCHAR(20),
  seat_type VARCHAR(20),
  offset_min_mm INTEGER,
  offset_max_mm INTEGER,
  
  -- Metadata
  reason TEXT NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Find overrides for a specific vehicle
CREATE INDEX IF NOT EXISTS fitment_overrides_scope_idx 
  ON fitment_overrides (scope, year, make, model);

CREATE INDEX IF NOT EXISTS fitment_overrides_active_idx 
  ON fitment_overrides (active);

-- ============================================================================
-- fitment_import_jobs - Track batch imports
-- ============================================================================

CREATE TABLE IF NOT EXISTS fitment_import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(50) NOT NULL,
  
  -- Scope
  year_start INTEGER,
  year_end INTEGER,
  makes JSONB,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  imported_records INTEGER NOT NULL DEFAULT 0,
  skipped_records INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Errors
  last_error TEXT,
  error_log JSONB,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fitment_import_jobs_status_idx 
  ON fitment_import_jobs (status);

CREATE INDEX IF NOT EXISTS fitment_import_jobs_source_idx 
  ON fitment_import_jobs (source);

-- ============================================================================
-- Add updated_at trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to vehicle_fitments
DROP TRIGGER IF EXISTS update_vehicle_fitments_updated_at ON vehicle_fitments;
CREATE TRIGGER update_vehicle_fitments_updated_at
  BEFORE UPDATE ON vehicle_fitments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to fitment_overrides
DROP TRIGGER IF EXISTS update_fitment_overrides_updated_at ON fitment_overrides;
CREATE TRIGGER update_fitment_overrides_updated_at
  BEFORE UPDATE ON fitment_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
