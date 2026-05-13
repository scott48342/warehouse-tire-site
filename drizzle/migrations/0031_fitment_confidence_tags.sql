-- Migration: Add confidence tags to vehicle_fitments
-- Purpose: Admin/audit visibility into data quality (no runtime behavior change)
-- Values: HIGH (complete OEM data), MEDIUM (partial/inferred), LOW (needs review)

-- Add the confidence_tag column
ALTER TABLE vehicle_fitments 
ADD COLUMN IF NOT EXISTS confidence_tag VARCHAR(20) DEFAULT 'MEDIUM';

-- Add index for filtering by confidence in admin tools
CREATE INDEX IF NOT EXISTS vehicle_fitments_confidence_idx 
ON vehicle_fitments (confidence_tag);

-- Comment explaining the tags
COMMENT ON COLUMN vehicle_fitments.confidence_tag IS 
'Data quality indicator for admin/audit purposes:
- HIGH: Complete OEM specs from verified sources (templates, manufacturer data)
- MEDIUM: Partial data, some fields inferred or derived from similar vehicles
- LOW: Needs manual review, missing critical specs, or conflicting sources';
