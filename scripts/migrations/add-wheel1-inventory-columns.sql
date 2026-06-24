-- Migration: Add Wheel-1 inventory columns to wheel1_products
-- Run once against production DB.
-- Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

BEGIN;

-- Inventory quantity (sum across all warehouses)
ALTER TABLE wheel1_products
  ADD COLUMN IF NOT EXISTS inventory_qty      INTEGER DEFAULT 0;

-- Per-warehouse breakdown as JSONB array
-- e.g. [{"warehouse":"TX","qty":12},{"warehouse":"NJ","qty":4}]
ALTER TABLE wheel1_products
  ADD COLUMN IF NOT EXISTS warehouse_stock    JSONB;

-- Primary warehouse code (highest-qty location)
ALTER TABLE wheel1_products
  ADD COLUMN IF NOT EXISTS primary_warehouse  TEXT;

-- Availability flag derived from inventory_qty > 0
ALTER TABLE wheel1_products
  ADD COLUMN IF NOT EXISTS is_available       BOOLEAN GENERATED ALWAYS AS (COALESCE(inventory_qty, 0) > 0) STORED;

-- Timestamp of last successful inventory sync
ALTER TABLE wheel1_products
  ADD COLUMN IF NOT EXISTS inventory_synced_at TIMESTAMPTZ;

-- Index for availability filtering (used in fitment-search)
CREATE INDEX IF NOT EXISTS idx_wheel1_available
  ON wheel1_products (is_available, is_discontinued, pcd1, pcd2);

-- Index for cost/MAP queries (used in pricing layer)
CREATE INDEX IF NOT EXISTS idx_wheel1_pricing
  ON wheel1_products (sku)
  WHERE dealer_cost IS NOT NULL;

COMMIT;

-- Verification
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'wheel1_products'
  AND column_name IN (
    'dealer_cost', 'map_price', 'msrp',
    'inventory_qty', 'warehouse_stock', 'primary_warehouse',
    'is_available', 'inventory_synced_at'
  )
ORDER BY ordinal_position;
