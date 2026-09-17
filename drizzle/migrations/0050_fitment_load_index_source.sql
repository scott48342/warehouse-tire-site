-- Per-field provenance for the service-spec columns (0049). Load index is now filled DB-wide from the
-- US AutoForce GetVehicleOptions feed while torque/pressure remain Tire Guide-only, so the block needs
-- its own source tag instead of inheriting wheel_specs_source. INTERNAL - never expose publicly.
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS load_index_source varchar(40);            -- 'tireguide-pro' | 'usaf'
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS load_index_verified_at timestamptz;
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS oem_speed_rating varchar(4);             -- OE tire speed symbol e.g. 'H', 'V', '(Y)'
-- Existing 363 tireguide rows: stamp provenance from the print pass.
UPDATE vehicle_fitments SET load_index_source = 'tireguide-pro', load_index_verified_at = updated_at
  WHERE oem_load_index IS NOT NULL AND load_index_source IS NULL AND wheel_specs_source = 'tireguide-pro';