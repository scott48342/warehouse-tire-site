-- Wheel-Size Trim Mappings
-- Maps our trim labels to Wheel-Size modification/submodel identifiers
-- Enables auto-selection when a trim has exactly one OEM configuration

CREATE TABLE IF NOT EXISTS wheel_size_trim_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Our vehicle identity (from vehicle_fitments)
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  our_trim VARCHAR(255) NOT NULL,
  our_modification_id VARCHAR(255),
  vehicle_fitment_id UUID REFERENCES vehicle_fitments(id) ON DELETE SET NULL,
  
  -- Wheel-Size identity (from cached source data)
  ws_slug VARCHAR(255) NOT NULL,
  ws_generation VARCHAR(100),
  ws_modification_name VARCHAR(255),
  ws_submodel VARCHAR(255),
  ws_trim VARCHAR(255),
  ws_engine VARCHAR(255),
  ws_body VARCHAR(100),
  
  -- Match metadata
  match_method VARCHAR(50) NOT NULL DEFAULT 'unknown',
  -- Values: exact, exact_normalized, fuzzy_high, fuzzy_medium, inferred, manual
  
  match_confidence VARCHAR(20) NOT NULL DEFAULT 'low',
  -- Values: high, medium, low
  
  match_score DECIMAL(5, 4), -- 0.0000 to 1.0000 similarity score
  
  -- Configuration resolution
  config_count INTEGER NOT NULL DEFAULT 0,
  has_single_config BOOLEAN NOT NULL DEFAULT false,
  default_config_id UUID REFERENCES vehicle_fitment_configurations(id) ON DELETE SET NULL,
  
  -- OEM package info (denormalized for quick access)
  default_wheel_diameter INTEGER,
  default_tire_size VARCHAR(50),
  all_wheel_diameters INTEGER[], -- All available OEM diameters
  all_tire_sizes VARCHAR(100)[], -- All available OEM tire sizes
  
  -- Admin review
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_reason VARCHAR(255),
  review_priority INTEGER DEFAULT 0, -- Higher = more urgent
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  
  -- Approval status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Values: pending, approved, rejected, needs_manual
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one mapping per our trim
  CONSTRAINT wheel_size_trim_mappings_unique 
    UNIQUE(year, make, model, our_trim)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS ws_trim_mappings_ymm_idx 
  ON wheel_size_trim_mappings(year, make, model);

CREATE INDEX IF NOT EXISTS ws_trim_mappings_status_idx 
  ON wheel_size_trim_mappings(status);

CREATE INDEX IF NOT EXISTS ws_trim_mappings_needs_review_idx 
  ON wheel_size_trim_mappings(needs_review, review_priority DESC);

CREATE INDEX IF NOT EXISTS ws_trim_mappings_confidence_idx 
  ON wheel_size_trim_mappings(match_confidence);

CREATE INDEX IF NOT EXISTS ws_trim_mappings_single_config_idx 
  ON wheel_size_trim_mappings(has_single_config) 
  WHERE has_single_config = true;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ws_trim_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ws_trim_mappings_updated_at ON wheel_size_trim_mappings;
CREATE TRIGGER ws_trim_mappings_updated_at
  BEFORE UPDATE ON wheel_size_trim_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_ws_trim_mappings_updated_at();

-- Comment explaining the table
COMMENT ON TABLE wheel_size_trim_mappings IS 
'Maps our vehicle trim labels to Wheel-Size modification identifiers.
Used to auto-select the correct OEM configuration when a trim has exactly one factory package.
Only shows the wheel/tire size chooser when multiple valid configurations exist.';
