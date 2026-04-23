-- Trim-specific wheel/tire fitment table
-- Links to vehicle_fitments for base specs (bolt pattern, center bore)
-- Stores trim-specific wheel sizes and tire sizes

CREATE TABLE IF NOT EXISTS trim_fitments (
  id SERIAL PRIMARY KEY,
  fitment_id UUID REFERENCES vehicle_fitments(id) ON DELETE CASCADE,
  trim VARCHAR(100) NOT NULL,
  
  -- Wheel specs for this trim
  wheel_diameter INTEGER,
  wheel_width DECIMAL(3,1),
  wheel_offset INTEGER,
  
  -- Tire specs for this trim  
  tire_size VARCHAR(50),
  
  -- Staggered setup (different front/rear)
  is_staggered BOOLEAN DEFAULT false,
  front_wheel_diameter INTEGER,
  front_wheel_width DECIMAL(3,1),
  front_wheel_offset INTEGER,
  front_tire_size VARCHAR(50),
  rear_wheel_diameter INTEGER,
  rear_wheel_width DECIMAL(3,1),
  rear_wheel_offset INTEGER,
  rear_tire_size VARCHAR(50),
  
  -- Metadata
  source VARCHAR(255),
  confidence VARCHAR(20) DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicates
  UNIQUE(fitment_id, trim)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_trim_fitments_fitment_id ON trim_fitments(fitment_id);
CREATE INDEX IF NOT EXISTS idx_trim_fitments_trim ON trim_fitments(trim);

-- Example usage after migration:
-- Base fitment: 2024 Toyota Camry -> bolt_pattern: 5x114.3, center_bore: 60.1mm
-- Trim fitments:
--   LE: 17x7.5 +40, 215/55R17
--   SE: 18x8 +45, 235/45R18  
--   XSE: 19x8 +45, 235/40R19
--   TRD: 19x8.5 +35, 235/40R19 (special TRD wheels)
