-- ============================================================================
-- P0 Make Normalization Fix — Optional Expression Index
-- Date: 2026-06-10  |  Branch: fix/p0-make-normalization
--
-- The fix compares: LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g')) = $1
-- This expression index lets Postgres use an index scan instead of seq scan.
--
-- Safe to run anytime (CONCURRENTLY = no table lock). Idempotent.
-- vehicle_fitments is ~37.5k rows, so this is optional — seq scans are still
-- fast at this size — but it future-proofs growth and removes regression risk
-- on hot selector paths.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vf_make_slug
  ON vehicle_fitments (LOWER(REGEXP_REPLACE(make, '[^a-zA-Z0-9]+', '-', 'g')));

-- Verify usage afterwards:
-- EXPLAIN ANALYZE SELECT * FROM vehicle_fitments
--   WHERE LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g')) = 'land-rover' AND year = 2022;

-- Rollback:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_vf_make_slug;
