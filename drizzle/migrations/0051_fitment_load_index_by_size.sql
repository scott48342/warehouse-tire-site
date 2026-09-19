-- H5 Option A (audit 2026-09-18, prepared 2026-09-19): per-size / per-axle OE load index.
--
-- vehicle_fitments.oem_load_index holds ONE value = the load index of oem_tire_sizes[0] (US AutoForce
-- backfill 2026-09-17). 13,946 of 28,149 LI rows list more than one OE size, and on staggered vehicles the
-- stored value is the FRONT (2020 Corvette: 89 stored, rear 305/30R20 is 103). A single scalar cannot be a
-- per-axle minimum, so the runtime currently fails closed (loadRequirementScope=per_axle_unknown).
--
-- This migration adds the per-size map. It is ADDITIVE ONLY: no existing column changes, no data writes.
-- The backfill is a separate, dry-run-first script (scripts/audit/pass5/h5-load-index-by-size/dry-run.mjs)
-- that runs only with Scott's explicit approval. Rollback: 0051_rollback.sql (drops the four columns).
--
-- Shape of oem_load_index_by_size (jsonb): {"245/35R19": 89, "305/30R20": 103}
--   keys   = OE tire size exactly as stored in oem_tire_sizes (normalized upper-case, no spaces)
--   values = single-wheel load index as reported by the source for THAT size
-- Shape of oem_speed_rating_by_size (jsonb): {"245/35R19": "Y", "305/30R20": "Y"}
-- Provenance: load_index_by_size_source ('usaf' | 'tireguide-pro' | 'tireguide-print'), INTERNAL - never expose.
-- Rows whose source lists the same size twice with different LIs keep the HIGHER value for that size and are
-- tagged 'usaf-max' (same rule Scott set 2026-09-17 for the scalar).
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS oem_load_index_by_size jsonb;
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS oem_speed_rating_by_size jsonb;
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS load_index_by_size_source varchar(40);
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS load_index_by_size_verified_at timestamptz;

-- Optional, cheap: lets the audit query "rows still lacking per-size data" without a seq scan.
CREATE INDEX IF NOT EXISTS vehicle_fitments_li_by_size_missing_idx
  ON vehicle_fitments (id) WHERE oem_load_index_by_size IS NULL AND oem_load_index IS NOT NULL;
