-- Suspension/Lift Kit Fitment Table
-- Stores YMM fitment data parsed from WheelPros Accessory TechGuide

CREATE TABLE IF NOT EXISTS suspension_fitments (
  id SERIAL PRIMARY KEY,
  
  -- Product info
  sku VARCHAR(50) NOT NULL,
  product_desc TEXT,
  brand VARCHAR(100),
  product_type VARCHAR(50),  -- 'BIG LIFT KITS', 'LEVELING KITS', etc.
  lift_height DECIMAL(4,2),  -- Lift height in inches (e.g., 2.5, 6.0)
  
  -- Vehicle fitment
  make VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,
  
  -- Pricing
  msrp DECIMAL(10,2),
  map_price DECIMAL(10,2),
  
  -- Images
  image_url TEXT,
  
  -- Metadata
  source VARCHAR(50) DEFAULT 'wheelpros_techfeed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(sku, make, model, year_start, year_end)
);

-- Indexes for fast YMM lookups
CREATE INDEX IF NOT EXISTS idx_suspension_fitments_ymm 
  ON suspension_fitments (make, model, year_start, year_end);

CREATE INDEX IF NOT EXISTS idx_suspension_fitments_make_model 
  ON suspension_fitments (make, model);

CREATE INDEX IF NOT EXISTS idx_suspension_fitments_sku 
  ON suspension_fitments (sku);

CREATE INDEX IF NOT EXISTS idx_suspension_fitments_year_range 
  ON suspension_fitments (year_start, year_end);

-- Example queries:
-- 
-- Find lift kits for 2022 Chevy Silverado 1500:
-- SELECT * FROM suspension_fitments 
-- WHERE make = 'Chevrolet' AND model = 'Silverado 1500' 
--   AND year_start <= 2022 AND year_end >= 2022;
--
-- Find all lift kits 4" or higher:
-- SELECT * FROM suspension_fitments WHERE lift_height >= 4;
