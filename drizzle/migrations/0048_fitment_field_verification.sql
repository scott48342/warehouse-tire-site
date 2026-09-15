-- Per-field verification for vehicle_fitments (audit Pass 2/3).
-- Tire sizes and wheel/bolt/offset are verified by different sources at different times,
-- so certification is tracked per field group rather than per row.
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS tire_sizes_verified_at timestamptz;
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS tire_sizes_source varchar(40);          -- internal provenance tag (never exposed publicly)
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS tire_sizes_confidence varchar(10);      -- HIGH | MEDIUM | LOW
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS tire_sizes_prev jsonb;                  -- what we had before the audit replaced/extended it
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS tire_sizes_needs_trim_split boolean DEFAULT false; -- Y/M/M-level sizes applied to a multi-trim vehicle; needs per-trim source
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS wheel_specs_verified_at timestamptz;
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS wheel_specs_source varchar(40);
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS wheel_specs_confidence varchar(10);
CREATE INDEX IF NOT EXISTS vehicle_fitments_tire_verified_idx ON vehicle_fitments (tire_sizes_verified_at) WHERE tire_sizes_verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS vehicle_fitments_wheel_verified_idx ON vehicle_fitments (wheel_specs_verified_at) WHERE wheel_specs_verified_at IS NOT NULL;
