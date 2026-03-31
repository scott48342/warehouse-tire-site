-- Tire Enrichment Tables Migration
-- Run with: psql $DATABASE_URL -f add-tire-enrichment-tables.sql

-- tire_asset_cache: stores enriched tire data (model names, images)
-- Primary key is the part number (SKU)
ALTER TABLE tire_asset_cache 
  ALTER COLUMN id TYPE TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model_normalized TEXT;

-- Add index for lookups by brand+model
CREATE INDEX IF NOT EXISTS idx_tire_asset_cache_brand_model 
  ON tire_asset_cache(LOWER(brand), LOWER(display_name));

-- tire_library_patterns: cache of TireLibrary pattern data
-- Used to look up images by brand+pattern name
CREATE TABLE IF NOT EXISTS tire_library_patterns (
  id SERIAL PRIMARY KEY,
  brand TEXT NOT NULL,
  pattern TEXT NOT NULL,
  pattern_id INTEGER,
  image_url TEXT,
  terrain TEXT,
  season TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand, pattern)
);

CREATE INDEX IF NOT EXISTS idx_tire_library_patterns_brand 
  ON tire_library_patterns(LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_tire_library_patterns_lookup 
  ON tire_library_patterns(LOWER(brand), LOWER(pattern));

-- Add brand and model columns to admin_product_flags if not exists
ALTER TABLE admin_product_flags 
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_product_flags_brand_model
  ON admin_product_flags(LOWER(brand), LOWER(model)) 
  WHERE product_type = 'tire';

-- View for quick stats
CREATE OR REPLACE VIEW tire_enrichment_stats AS
SELECT 
  (SELECT COUNT(*) FROM tire_asset_cache) AS cached_tires,
  (SELECT COUNT(*) FROM tire_asset_cache WHERE image_url IS NOT NULL) AS with_images,
  (SELECT COUNT(*) FROM tire_asset_cache WHERE image_url IS NULL) AS without_images,
  (SELECT COUNT(*) FROM tire_library_patterns) AS patterns_cached,
  (SELECT COUNT(DISTINCT brand) FROM tire_library_patterns) AS brands_with_patterns;
