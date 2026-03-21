-- Extended Fitment Override Fields
-- Migration: 0003_fitment_override_extended
-- 
-- Adds support for:
-- - OEM wheel/tire size overrides (JSON arrays)
-- - Force quality level (bypass validation)
-- - Notes field for additional context

-- Add new columns to fitment_overrides
ALTER TABLE fitment_overrides 
ADD COLUMN IF NOT EXISTS oem_wheel_sizes JSONB,
ADD COLUMN IF NOT EXISTS oem_tire_sizes JSONB,
ADD COLUMN IF NOT EXISTS force_quality VARCHAR(20),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add constraint for force_quality values
ALTER TABLE fitment_overrides 
DROP CONSTRAINT IF EXISTS fitment_overrides_force_quality_check;

ALTER TABLE fitment_overrides 
ADD CONSTRAINT fitment_overrides_force_quality_check 
CHECK (force_quality IS NULL OR force_quality IN ('valid', 'partial'));

-- Comment the new columns
COMMENT ON COLUMN fitment_overrides.oem_wheel_sizes IS 'JSON array of wheel sizes [{diameter, width, offset, axle, isStock}]';
COMMENT ON COLUMN fitment_overrides.oem_tire_sizes IS 'JSON array of tire size strings like ["275/55R20"]';
COMMENT ON COLUMN fitment_overrides.force_quality IS 'Force profile quality to "valid" or "partial" (bypasses assessment)';
COMMENT ON COLUMN fitment_overrides.notes IS 'Additional notes about why this override exists';
