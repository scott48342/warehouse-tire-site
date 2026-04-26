-- PHASE 1: Complete Certification Metadata
-- Run this migration to add missing certification columns

-- Add certified_at if missing
ALTER TABLE vehicle_fitments 
ADD COLUMN IF NOT EXISTS certified_at TIMESTAMPTZ;

-- Add certified_by_script_version if missing
ALTER TABLE vehicle_fitments 
ADD COLUMN IF NOT EXISTS certified_by_script_version VARCHAR(50);

-- Add quarantined_at if missing
ALTER TABLE vehicle_fitments 
ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ;

-- Add certification_errors if missing (should exist already)
ALTER TABLE vehicle_fitments 
ADD COLUMN IF NOT EXISTS certification_errors JSONB DEFAULT '[]'::jsonb;

-- Add audit_original_data if missing (should exist already)
ALTER TABLE vehicle_fitments 
ADD COLUMN IF NOT EXISTS audit_original_data JSONB;

-- Create index for certification queries
CREATE INDEX IF NOT EXISTS idx_vehicle_fitments_certification_status 
ON vehicle_fitments(certification_status);

CREATE INDEX IF NOT EXISTS idx_vehicle_fitments_certified_at 
ON vehicle_fitments(certified_at);

-- Backfill certified_at for existing certified records
UPDATE vehicle_fitments 
SET certified_at = COALESCE(updated_at, created_at, NOW()),
    certified_by_script_version = 'v1.0.0-initial'
WHERE certification_status = 'certified' 
  AND certified_at IS NULL;

-- Verify
SELECT 
  certification_status,
  COUNT(*) as count,
  COUNT(certified_at) as has_certified_at,
  COUNT(certified_by_script_version) as has_version
FROM vehicle_fitments
GROUP BY certification_status;
