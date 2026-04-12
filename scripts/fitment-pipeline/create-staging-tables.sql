-- Fitment Staging Tables Migration
-- Creates the staging layer for the fitment discovery/validation/promotion pipeline

-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE staging_status AS ENUM ('pending', 'validated', 'flagged', 'promoted', 'rejected', 'superseded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE change_action AS ENUM ('discovered', 'validated', 'flagged', 'promoted', 'rejected', 'updated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- fitment_staging
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fitment_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vehicle identity
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  raw_trim VARCHAR(255),
  display_trim VARCHAR(255),
  submodel VARCHAR(255),
  modification_id VARCHAR(255),
  
  -- Source tracking
  source VARCHAR(50) NOT NULL,
  source_record_id VARCHAR(255),
  source_checksum VARCHAR(64),
  
  -- Wheel specifications
  bolt_pattern VARCHAR(20),
  center_bore_mm DECIMAL(5,1),
  thread_size VARCHAR(20),
  seat_type VARCHAR(20),
  offset_min_mm DECIMAL(5,2),
  offset_max_mm DECIMAL(5,2),
  oem_wheel_sizes JSONB DEFAULT '[]'::jsonb,
  
  -- Tire specifications
  oem_tire_sizes JSONB DEFAULT '[]'::jsonb,
  
  -- Full raw payload
  raw_payload JSONB,
  
  -- Pipeline status
  status staging_status NOT NULL DEFAULT 'pending',
  confidence VARCHAR(20) DEFAULT 'unknown',
  
  -- Validation results
  validation_passed BOOLEAN,
  validation_flags JSONB DEFAULT '[]'::jsonb,
  validation_notes TEXT,
  
  -- Reference to existing production record
  existing_fitment_id UUID,
  is_update BOOLEAN DEFAULT false,
  
  -- Timestamps
  discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  validated_at TIMESTAMP,
  promoted_at TIMESTAMP,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS fitment_staging_source_unique_idx 
  ON fitment_staging(source, source_record_id);
CREATE INDEX IF NOT EXISTS fitment_staging_status_idx ON fitment_staging(status);
CREATE INDEX IF NOT EXISTS fitment_staging_year_idx ON fitment_staging(year);
CREATE INDEX IF NOT EXISTS fitment_staging_vehicle_idx ON fitment_staging(year, make, model);

-- ═══════════════════════════════════════════════════════════════════════════
-- fitment_staging_audit
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fitment_staging_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id UUID NOT NULL REFERENCES fitment_staging(id) ON DELETE CASCADE,
  
  -- Validation run info
  run_id UUID NOT NULL,
  run_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Check results
  check_name VARCHAR(100) NOT NULL,
  check_passed BOOLEAN NOT NULL,
  check_severity VARCHAR(20) NOT NULL,
  check_message TEXT,
  check_details JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS fitment_staging_audit_staging_idx ON fitment_staging_audit(staging_id);
CREATE INDEX IF NOT EXISTS fitment_staging_audit_run_idx ON fitment_staging_audit(run_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- fitment_change_log
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fitment_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What changed
  staging_id UUID REFERENCES fitment_staging(id),
  production_fitment_id UUID,
  
  -- Action taken
  action change_action NOT NULL,
  
  -- Context
  year INTEGER,
  make VARCHAR(100),
  model VARCHAR(100),
  trim VARCHAR(255),
  
  -- Details
  previous_data JSONB,
  new_data JSONB,
  reason TEXT,
  
  -- Who/when
  actor VARCHAR(100) DEFAULT 'pipeline',
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS fitment_change_log_staging_idx ON fitment_change_log(staging_id);
CREATE INDEX IF NOT EXISTS fitment_change_log_action_idx ON fitment_change_log(action);
CREATE INDEX IF NOT EXISTS fitment_change_log_timestamp_idx ON fitment_change_log(timestamp);

-- ═══════════════════════════════════════════════════════════════════════════
-- fitment_pipeline_runs
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fitment_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run info
  run_type VARCHAR(50) NOT NULL,
  target_year INTEGER,
  
  -- Timing
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- Results summary
  records_discovered INTEGER DEFAULT 0,
  records_validated INTEGER DEFAULT 0,
  records_flagged INTEGER DEFAULT 0,
  records_promoted INTEGER DEFAULT 0,
  records_rejected INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  error_message TEXT,
  
  -- Full summary
  summary JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS fitment_pipeline_runs_type_idx ON fitment_pipeline_runs(run_type);
CREATE INDEX IF NOT EXISTS fitment_pipeline_runs_started_idx ON fitment_pipeline_runs(started_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 'Fitment staging tables created successfully' as status;
