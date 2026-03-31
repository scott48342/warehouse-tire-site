-- Migration: Create classic_fitments table
-- COMPLETELY SEPARATE from vehicle_fitments
-- Platform-based fitment for classic/muscle cars
-- 
-- Rollback: DROP TABLE classic_fitments;
-- Surgical rollback: UPDATE classic_fitments SET is_active = false WHERE batch_tag = 'xxx';

CREATE TABLE IF NOT EXISTS classic_fitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Platform Identity (primary grouping)
  platform_code VARCHAR(50) NOT NULL,
  platform_name VARCHAR(100) NOT NULL,
  generation_name VARCHAR(100),

  -- Vehicle Coverage
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,

  -- Fitment Classification
  fitment_level VARCHAR(50) NOT NULL DEFAULT 'classic-platform',
  fitment_source VARCHAR(100) NOT NULL,
  fitment_style VARCHAR(50) NOT NULL DEFAULT 'stock_baseline',
  -- fitment_style values: 'stock_baseline' | 'restomod_common' | 'big_brake_sensitive'

  -- Confidence & Verification
  confidence VARCHAR(20) NOT NULL,
  -- confidence values: 'high' | 'medium' | 'low'
  verification_note TEXT,
  requires_clearance_check BOOLEAN DEFAULT true,
  common_modifications JSONB DEFAULT '[]'::jsonb,

  -- Baseline Fitment Specs (stock reference)
  common_bolt_pattern VARCHAR(20) NOT NULL,
  common_center_bore DECIMAL(5,1),
  common_thread_size VARCHAR(20),
  common_seat_type VARCHAR(20),

  -- Recommended Wheel Ranges (not exact OEM)
  rec_wheel_diameter_min INTEGER,
  rec_wheel_diameter_max INTEGER,
  rec_wheel_width_min DECIMAL(4,1),
  rec_wheel_width_max DECIMAL(4,1),
  rec_offset_min_mm INTEGER,
  rec_offset_max_mm INTEGER,

  -- Stock Baseline Reference (for comparison/display)
  stock_wheel_diameter INTEGER,
  stock_wheel_width DECIMAL(4,1),
  stock_tire_size VARCHAR(50),

  -- Modification Risk Assessment
  modification_risk VARCHAR(20) DEFAULT 'medium',
  -- modification_risk values: 'low' | 'medium' | 'high'

  -- Surgical Rollback Fields
  batch_tag VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS classic_fitments_platform_make_model_idx 
  ON classic_fitments(platform_code, make, model);

CREATE INDEX IF NOT EXISTS classic_fitments_platform_idx 
  ON classic_fitments(platform_code);

CREATE INDEX IF NOT EXISTS classic_fitments_make_model_idx 
  ON classic_fitments(make, model);

CREATE INDEX IF NOT EXISTS classic_fitments_year_range_idx 
  ON classic_fitments(year_start, year_end);

CREATE INDEX IF NOT EXISTS classic_fitments_batch_idx 
  ON classic_fitments(batch_tag);

CREATE INDEX IF NOT EXISTS classic_fitments_active_idx 
  ON classic_fitments(is_active);

-- Comment
COMMENT ON TABLE classic_fitments IS 'Platform-based fitment for classic/muscle cars. SEPARATE from vehicle_fitments.';
