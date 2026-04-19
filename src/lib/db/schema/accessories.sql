-- Accessories Table
-- Stores center caps, lug nuts, hub rings, lights, TPMS, valve stems
-- Synced from WheelPros TechFeed daily

CREATE TABLE IF NOT EXISTS accessories (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  
  -- Basic product info
  title VARCHAR(500) NOT NULL,
  brand VARCHAR(100),
  brand_code VARCHAR(10),
  
  -- Category (for filtering)
  category VARCHAR(30) NOT NULL, -- 'center_cap', 'lug_nut', 'hub_ring', 'lighting', 'tpms', 'valve_stem', 'spacer', 'other'
  sub_type VARCHAR(50),          -- More specific: 'wheel_lock', 'lug_kit', 'led_pod', 'light_bar', 'rock_light'
  
  -- Pricing
  msrp DECIMAL(10,2),
  map_price DECIMAL(10,2),
  sell_price DECIMAL(10,2),      -- Calculated: cost + margin
  cost DECIMAL(10,2),            -- NIP/dealer cost
  
  -- Images
  image_url VARCHAR(500),
  image_url_2 VARCHAR(500),
  image_url_3 VARCHAR(500),
  
  -- Inventory
  in_stock BOOLEAN DEFAULT false,
  qty_available INTEGER DEFAULT 0,
  
  -- Fitment specs (parsed from title/description)
  -- For lug nuts:
  thread_size VARCHAR(20),       -- 'M14x1.5', 'M12x1.25', '1/2-20'
  seat_type VARCHAR(20),         -- 'conical', 'ball', 'mag', 'flat'
  lug_count INTEGER,             -- 20 (kit of 20), 24 (kit of 24), 1 (individual)
  hex_size VARCHAR(10),          -- '19mm', '3/4"'
  
  -- For hub rings:
  outer_diameter DECIMAL(6,2),   -- Wheel bore (mm)
  inner_diameter DECIMAL(6,2),   -- Vehicle hub (mm)
  
  -- For center caps:
  cap_diameter DECIMAL(6,2),     -- Cap size (mm)
  bolt_pattern VARCHAR(30),      -- '8x170', '6x139.7' (for pattern-specific caps)
  wheel_brand VARCHAR(50),       -- Compatible wheel brand
  wheel_models TEXT,             -- JSON array of compatible wheel model codes
  
  -- For lighting:
  wattage INTEGER,
  lumens INTEGER,
  light_type VARCHAR(30),        -- 'spot', 'flood', 'combo'
  
  -- Metadata
  upc VARCHAR(20),
  source VARCHAR(20) DEFAULT 'wheelpros', -- 'wheelpros', 'tireweb', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Searchable text (for full-text search)
  search_text TSVECTOR
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_accessories_category ON accessories(category);
CREATE INDEX IF NOT EXISTS idx_accessories_brand ON accessories(brand);
CREATE INDEX IF NOT EXISTS idx_accessories_brand_code ON accessories(brand_code);
CREATE INDEX IF NOT EXISTS idx_accessories_in_stock ON accessories(in_stock);
CREATE INDEX IF NOT EXISTS idx_accessories_thread_size ON accessories(thread_size) WHERE thread_size IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accessories_hub_ring ON accessories(outer_diameter, inner_diameter) WHERE category = 'hub_ring';
CREATE INDEX IF NOT EXISTS idx_accessories_wheel_brand ON accessories(wheel_brand) WHERE wheel_brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accessories_bolt_pattern ON accessories(bolt_pattern) WHERE bolt_pattern IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accessories_search ON accessories USING GIN(search_text);

-- Function to update search_text on insert/update
CREATE OR REPLACE FUNCTION accessories_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_text := to_tsvector('english',
    COALESCE(NEW.sku, '') || ' ' ||
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.brand, '') || ' ' ||
    COALESCE(NEW.wheel_brand, '') || ' ' ||
    COALESCE(NEW.thread_size, '') || ' ' ||
    COALESCE(NEW.bolt_pattern, '')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accessories_search_update ON accessories;
CREATE TRIGGER accessories_search_update
  BEFORE INSERT OR UPDATE ON accessories
  FOR EACH ROW EXECUTE FUNCTION accessories_search_trigger();

-- Accessory-Wheel Compatibility (for center caps)
-- Maps specific accessories to compatible wheel SKUs/models
CREATE TABLE IF NOT EXISTS accessory_wheel_compat (
  id SERIAL PRIMARY KEY,
  accessory_sku VARCHAR(50) NOT NULL REFERENCES accessories(sku) ON DELETE CASCADE,
  wheel_sku VARCHAR(50),           -- Specific wheel SKU (if known)
  wheel_brand VARCHAR(50),         -- Brand match (e.g., 'Fuel', 'Moto Metal')
  wheel_model VARCHAR(100),        -- Model pattern match (e.g., 'D%', 'MO%')
  bolt_pattern VARCHAR(30),        -- Bolt pattern requirement
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(accessory_sku, wheel_sku, wheel_brand, wheel_model)
);

CREATE INDEX IF NOT EXISTS idx_compat_accessory ON accessory_wheel_compat(accessory_sku);
CREATE INDEX IF NOT EXISTS idx_compat_wheel_sku ON accessory_wheel_compat(wheel_sku) WHERE wheel_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compat_wheel_brand ON accessory_wheel_compat(wheel_brand) WHERE wheel_brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_compat_bolt_pattern ON accessory_wheel_compat(bolt_pattern) WHERE bolt_pattern IS NOT NULL;
