-- TireWeb SKU cache for direct URL lookups
-- Stores partNumber → size mapping so /tires/{sku} works without query params

CREATE TABLE IF NOT EXISTS tireweb_sku_cache (
  part_number TEXT PRIMARY KEY,
  size TEXT NOT NULL,
  brand TEXT,
  source TEXT,  -- e.g., "tireweb:atd", "tireweb:ntw"
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_tireweb_sku_cache_size ON tireweb_sku_cache(size);

-- Cleanup old entries (run periodically)
-- DELETE FROM tireweb_sku_cache WHERE last_seen_at < NOW() - INTERVAL '90 days';
