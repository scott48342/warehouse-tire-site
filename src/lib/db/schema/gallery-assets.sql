-- Gallery Assets Table
-- Stores vehicle/wheel imagery from WheelPros Canto library
-- Used to enhance build flow and product pages with real-world examples

CREATE TABLE IF NOT EXISTS gallery_assets (
  id SERIAL PRIMARY KEY,
  
  -- Source tracking (Canto)
  source_asset_id VARCHAR(100),         -- Canto asset ID
  source_album_name VARCHAR(255),       -- Raw album name (e.g., "BLADE 2024 FORD BRONCO")
  source_url TEXT,                      -- Direct URL to asset
  
  -- Hosted copies (for CDN delivery)
  cdn_url TEXT,                         -- Our CDN copy
  thumbnail_url TEXT,                   -- Smaller thumbnail
  
  -- Media info
  media_type VARCHAR(20) NOT NULL,      -- 'image' | 'video'
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  
  -- Parsed: Wheel info
  wheel_brand VARCHAR(50),              -- 'Fuel' | 'KMC' | 'Moto Metal' | 'XD'
  wheel_model VARCHAR(100),             -- 'Rebel' | 'Covert' | 'Blitz'
  wheel_sku VARCHAR(50),                -- 'D679' | NULL if unknown
  
  -- Parsed: Vehicle info
  vehicle_year INTEGER,                 -- 2024 | NULL if not in album name
  vehicle_make VARCHAR(50),             -- 'Ford' | 'Chevrolet' | 'RAM' | 'Toyota'
  vehicle_model VARCHAR(100),           -- 'F-150' | 'Silverado' | 'Wrangler'
  vehicle_trim VARCHAR(100),            -- 'Raptor' | 'TRX' | 'Denali' | 'Tremor' | NULL
  vehicle_type VARCHAR(30),             -- 'truck' | 'suv' | 'car' | 'jeep' | 'dually'
  
  -- To be enriched later (Phase 2+)
  lift_level VARCHAR(20),               -- 'stock' | 'leveled' | 'lifted' | NULL
  build_style VARCHAR(30),              -- 'aggressive' | 'daily' | 'offroad' | 'show' | NULL
  environment VARCHAR(30),              -- 'studio' | 'street' | 'trail' | 'desert' | NULL
  
  -- Quality flags
  is_hero BOOLEAN DEFAULT false,        -- High-quality hero shot
  is_featured BOOLEAN DEFAULT false,    -- Manually curated
  
  -- Parse quality tracking
  parse_confidence VARCHAR(20) DEFAULT 'auto',  -- 'auto' | 'verified' | 'manual'
  parse_notes TEXT,                     -- Notes about parsing edge cases
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate imports
  UNIQUE(source_asset_id, wheel_brand)
);

-- Indexes for fast matching queries
CREATE INDEX IF NOT EXISTS idx_gallery_vehicle 
  ON gallery_assets (vehicle_make, vehicle_model);

CREATE INDEX IF NOT EXISTS idx_gallery_vehicle_year 
  ON gallery_assets (vehicle_make, vehicle_model, vehicle_year);

CREATE INDEX IF NOT EXISTS idx_gallery_wheel 
  ON gallery_assets (wheel_brand, wheel_model);

CREATE INDEX IF NOT EXISTS idx_gallery_wheel_sku 
  ON gallery_assets (wheel_sku);

CREATE INDEX IF NOT EXISTS idx_gallery_lift 
  ON gallery_assets (lift_level);

CREATE INDEX IF NOT EXISTS idx_gallery_type 
  ON gallery_assets (vehicle_type);

CREATE INDEX IF NOT EXISTS idx_gallery_media_type 
  ON gallery_assets (media_type);

CREATE INDEX IF NOT EXISTS idx_gallery_album 
  ON gallery_assets (source_album_name);

-- Example queries:
--
-- Find images for Ford F-150 builds:
-- SELECT * FROM gallery_assets 
-- WHERE vehicle_make = 'Ford' AND vehicle_model = 'F-150'
-- ORDER BY is_hero DESC, created_at DESC;
--
-- Find images for Fuel Rebel wheel:
-- SELECT * FROM gallery_assets 
-- WHERE wheel_brand = 'Fuel' AND wheel_model = 'Rebel';
--
-- Find lifted truck images:
-- SELECT * FROM gallery_assets 
-- WHERE vehicle_type = 'truck' AND lift_level = 'lifted';
