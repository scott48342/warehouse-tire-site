-- Expand tireweb_sku_cache to store UTQG and tire specs
-- This allows us to persist spec data from TireWeb/USAF API responses

-- Add new columns for tire specifications
ALTER TABLE tireweb_sku_cache
  ADD COLUMN IF NOT EXISTS utqg TEXT,
  ADD COLUMN IF NOT EXISTS treadwear INTEGER,
  ADD COLUMN IF NOT EXISTS traction TEXT,
  ADD COLUMN IF NOT EXISTS temperature TEXT,
  ADD COLUMN IF NOT EXISTS tread_depth NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS mileage_warranty INTEGER,
  ADD COLUMN IF NOT EXISTS load_index TEXT,
  ADD COLUMN IF NOT EXISTS speed_rating TEXT,
  ADD COLUMN IF NOT EXISTS load_range TEXT,
  ADD COLUMN IF NOT EXISTS terrain TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS msrp NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS map_price NUMERIC(10,2);

-- Add index for brand lookups (used by brands API)
CREATE INDEX IF NOT EXISTS idx_tireweb_sku_cache_brand 
  ON tireweb_sku_cache(brand);

-- Add index for UTQG filtering
CREATE INDEX IF NOT EXISTS idx_tireweb_sku_cache_utqg 
  ON tireweb_sku_cache(utqg) WHERE utqg IS NOT NULL;

-- Add composite index for spec lookups
CREATE INDEX IF NOT EXISTS idx_tireweb_sku_cache_specs 
  ON tireweb_sku_cache(brand, model) WHERE model IS NOT NULL;

COMMENT ON COLUMN tireweb_sku_cache.utqg IS 'UTQG rating string, e.g., "700BA"';
COMMENT ON COLUMN tireweb_sku_cache.treadwear IS 'Parsed treadwear rating from UTQG';
COMMENT ON COLUMN tireweb_sku_cache.traction IS 'Traction grade: AA, A, B, C';
COMMENT ON COLUMN tireweb_sku_cache.temperature IS 'Temperature grade: A, B, C';
COMMENT ON COLUMN tireweb_sku_cache.tread_depth IS 'Tread depth in 32nds of an inch';
COMMENT ON COLUMN tireweb_sku_cache.mileage_warranty IS 'Mileage warranty in miles';
COMMENT ON COLUMN tireweb_sku_cache.map_price IS 'Minimum Advertised Price from supplier';
