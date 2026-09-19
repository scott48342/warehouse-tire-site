-- Rollback for 0051_fitment_load_index_by_size.sql. Safe at any time: the runtime treats a missing/NULL
-- per-size map as "not available" and stays on the fail-closed scalar path. Drop the runtime commit
-- (branch h5-option-a) BEFORE running this if it has been deployed, otherwise Drizzle selects will 42703.
DROP INDEX IF EXISTS vehicle_fitments_li_by_size_missing_idx;
ALTER TABLE vehicle_fitments DROP COLUMN IF EXISTS load_index_by_size_verified_at;
ALTER TABLE vehicle_fitments DROP COLUMN IF EXISTS load_index_by_size_source;
ALTER TABLE vehicle_fitments DROP COLUMN IF EXISTS oem_speed_rating_by_size;
ALTER TABLE vehicle_fitments DROP COLUMN IF EXISTS oem_load_index_by_size;
-- If the backfill --apply was ever run, the pre-apply scalar values are preserved in
-- audit_h5_load_index_by_size_original (id, oem_load_index, load_index_source, load_index_verified_at,
-- captured_at). The backfill does NOT change oem_load_index, so nothing scalar needs restoring.
