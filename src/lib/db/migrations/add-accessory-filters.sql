-- Add WheelPros DealerLine Filter Attributes
-- These are used for filtering on the accessories browse page

-- For lug nuts
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS material VARCHAR(30);         -- 'Chrome', 'Black Chrome', 'Zinc', 'Stainless Steel'
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS closed_end BOOLEAN;           -- true = closed, false = open
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS is_bolt BOOLEAN;              -- true = bolt style, false = nut style
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS heat_treated BOOLEAN;         -- heat treated for strength
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS style VARCHAR(50);            -- 'Acorn', 'Bulge', 'Spline', 'Tuner', etc.
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS package_type VARCHAR(30);     -- 'Kit', 'Bulk', 'Carded', 'Bag'
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS piece_count INTEGER;          -- Number of pieces in package (20, 24, etc.)
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS shank_length DECIMAL(5,2);    -- Length of thread (mm)

-- For lighting
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS beam_pattern VARCHAR(30);     -- 'Spot', 'Flood', 'Combo'
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS color_temp INTEGER;           -- Color temperature in Kelvin
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS size_inches VARCHAR(20);      -- '6"', '20"', '50"' for light bars

-- For TPMS
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS sensor_type VARCHAR(30);      -- 'Direct', 'Indirect', 'Programmable'
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS vehicle_makes TEXT[];         -- Array of compatible makes

-- Indexes for new filter columns
CREATE INDEX IF NOT EXISTS idx_accessories_material ON accessories(material) WHERE material IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accessories_style ON accessories(style) WHERE style IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accessories_closed_end ON accessories(closed_end) WHERE closed_end IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accessories_package_type ON accessories(package_type) WHERE package_type IS NOT NULL;

-- Update search trigger to include new fields
CREATE OR REPLACE FUNCTION accessories_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_text := to_tsvector('english',
    COALESCE(NEW.sku, '') || ' ' ||
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.brand, '') || ' ' ||
    COALESCE(NEW.wheel_brand, '') || ' ' ||
    COALESCE(NEW.thread_size, '') || ' ' ||
    COALESCE(NEW.bolt_pattern, '') || ' ' ||
    COALESCE(NEW.material, '') || ' ' ||
    COALESCE(NEW.style, '')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
