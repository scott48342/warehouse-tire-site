-- Wheel Style Assets table
-- Tracks which wheel models (styles) are visualizer-ready
-- One row per style, not per SKU

CREATE TABLE IF NOT EXISTS wheel_style_assets (
  style_key VARCHAR(100) PRIMARY KEY,
  
  -- Wheel identification
  brand_code VARCHAR(20),
  brand VARCHAR(100),
  model VARCHAR(255),
  
  -- Image info
  image_url VARCHAR(500),
  normalized_image_url VARCHAR(500),
  
  -- Classification
  is_front_facing BOOLEAN,
  classification_confidence INTEGER,
  
  -- Status: pending, usable, needs_normalization, rejected
  visualizer_status VARCHAR(30) DEFAULT 'pending',
  
  -- Metadata
  classified_at TIMESTAMP,
  classified_by VARCHAR(50),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS wheel_style_assets_front_facing_idx 
  ON wheel_style_assets (is_front_facing);
  
CREATE INDEX IF NOT EXISTS wheel_style_assets_status_idx 
  ON wheel_style_assets (visualizer_status);

-- Partial index for visualizer queries (only front-facing, usable wheels)
CREATE INDEX IF NOT EXISTS wheel_style_assets_visualizer_ready_idx 
  ON wheel_style_assets (style_key) 
  WHERE is_front_facing = true AND visualizer_status = 'usable';
