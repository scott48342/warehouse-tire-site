-- ============================================================================
-- FITMENT DATABASE LOCKDOWN SCHEMA
-- ============================================================================
-- This migration creates:
-- 1. fitment_change_log - Audit trail for all changes
-- 2. vehicle_fitments_staging - Staging table for imports
-- 3. fitment_dataset_versions - Version tracking
-- 4. Triggers to enforce audit logging
-- 5. Read-only view for app queries
-- ============================================================================

-- ============================================================================
-- 1. CHANGE LOG TABLE (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fitment_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What changed
  fitment_id UUID NOT NULL,
  operation VARCHAR(20) NOT NULL,  -- INSERT, UPDATE, DELETE, PROMOTE, ROLLBACK
  
  -- Before/After snapshots
  old_data JSONB,
  new_data JSONB,
  
  -- What changed specifically
  changed_fields TEXT[],
  
  -- Source tracking
  source_script VARCHAR(200),
  source_version VARCHAR(50),
  reason TEXT,
  
  -- Who/when
  performed_by VARCHAR(100) DEFAULT 'system',
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Batch tracking
  batch_id UUID,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fitment_change_log_fitment_id ON fitment_change_log(fitment_id);
CREATE INDEX IF NOT EXISTS idx_fitment_change_log_operation ON fitment_change_log(operation);
CREATE INDEX IF NOT EXISTS idx_fitment_change_log_performed_at ON fitment_change_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_fitment_change_log_batch_id ON fitment_change_log(batch_id);

-- ============================================================================
-- 2. STAGING TABLE (Mirror of vehicle_fitments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_fitments_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Same columns as vehicle_fitments
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(255) NOT NULL,
  raw_trim VARCHAR(255),
  bolt_pattern VARCHAR(50),
  center_bore_mm DECIMAL(5,2),
  oem_wheel_sizes JSONB DEFAULT '[]'::jsonb,
  oem_tire_sizes JSONB DEFAULT '[]'::jsonb,
  is_staggered BOOLEAN DEFAULT FALSE,
  
  -- Certification fields (for pre-certification)
  certification_status VARCHAR(50) DEFAULT 'pending',
  certification_errors JSONB DEFAULT '[]'::jsonb,
  audit_original_data JSONB,
  
  -- Staging-specific fields
  staging_status VARCHAR(50) DEFAULT 'pending',  -- pending, certified, promoted, rejected
  staged_at TIMESTAMPTZ DEFAULT NOW(),
  staged_by VARCHAR(100) DEFAULT 'import',
  source_script VARCHAR(200),
  source_version VARCHAR(50),
  batch_id UUID,
  
  -- Reference to live record (if updating existing)
  live_fitment_id UUID,
  
  -- Promotion tracking
  promoted_at TIMESTAMPTZ,
  promoted_by VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitments_staging_status ON vehicle_fitments_staging(staging_status);
CREATE INDEX IF NOT EXISTS idx_fitments_staging_batch ON vehicle_fitments_staging(batch_id);
CREATE INDEX IF NOT EXISTS idx_fitments_staging_ymm ON vehicle_fitments_staging(year, make, model);

-- ============================================================================
-- 3. DATASET VERSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fitment_dataset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  version VARCHAR(50) NOT NULL UNIQUE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, active, archived, rollback
  
  -- Stats at time of version
  total_records INTEGER,
  certified_records INTEGER,
  needs_review_records INTEGER,
  certification_pct DECIMAL(5,2),
  
  -- Source info
  source_description TEXT,
  source_script VARCHAR(200),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Who
  created_by VARCHAR(100) DEFAULT 'system',
  activated_by VARCHAR(100),
  
  -- Notes
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fitment_versions_status ON fitment_dataset_versions(status);
CREATE INDEX IF NOT EXISTS idx_fitment_versions_version ON fitment_dataset_versions(version);

-- ============================================================================
-- 4. LOCKDOWN FLAG ON MAIN TABLE
-- ============================================================================

-- Add locked flag to vehicle_fitments if not exists
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT TRUE;
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(50);
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(100);
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS last_modified_reason TEXT;

-- Lock all existing certified records
UPDATE vehicle_fitments SET is_locked = TRUE WHERE certification_status = 'certified';
UPDATE vehicle_fitments SET dataset_version = 'v1.0.0-initial' WHERE dataset_version IS NULL;

-- ============================================================================
-- 5. READ-ONLY VIEW FOR APP QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW certified_vehicle_fitments AS
SELECT 
  id,
  year,
  make,
  model,
  raw_trim,
  bolt_pattern,
  center_bore_mm,
  oem_wheel_sizes,
  oem_tire_sizes,
  is_staggered,
  certified_at,
  dataset_version
FROM vehicle_fitments
WHERE certification_status = 'certified'
  AND is_locked = TRUE;

-- ============================================================================
-- 6. INSERT INITIAL VERSION RECORD
-- ============================================================================

INSERT INTO fitment_dataset_versions (
  version,
  status,
  total_records,
  certified_records,
  needs_review_records,
  certification_pct,
  source_description,
  created_by,
  activated_at,
  activated_by
)
SELECT 
  'v1.0.0-initial',
  'active',
  COUNT(*),
  COUNT(*) FILTER (WHERE certification_status = 'certified'),
  COUNT(*) FILTER (WHERE certification_status = 'needs_review'),
  ROUND((COUNT(*) FILTER (WHERE certification_status = 'certified')::numeric / COUNT(*) * 100), 2),
  'Initial certified dataset after cleanup',
  'system',
  NOW(),
  'system'
FROM vehicle_fitments
ON CONFLICT (version) DO NOTHING;
