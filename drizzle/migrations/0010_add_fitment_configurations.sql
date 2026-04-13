-- Migration: Add vehicle_fitment_configurations table
-- Purpose: Support exact OEM wheel+tire pairings per trim configuration
-- Strategy: ADDITIVE ONLY - does not modify or remove existing columns
-- 
-- This enables moving from aggregated arrays toward explicit config records:
--   Before: oemWheelSizes = [22x9, 24x10], oemTireSizes = [275/50R22, 285/40R24]
--   After:  config A = 22x9 + 275/50R22, config B = 24x10 + 285/40R24

CREATE TABLE IF NOT EXISTS "vehicle_fitment_configurations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to parent fitment record (nullable for direct lookups)
  "vehicle_fitment_id" uuid REFERENCES "vehicle_fitments"("id"),
  
  -- Denormalized vehicle identity (for direct lookups without join)
  "year" integer NOT NULL,
  "make_key" varchar(100) NOT NULL,
  "model_key" varchar(100) NOT NULL,
  "modification_id" varchar(255),
  "display_trim" varchar(255),
  
  -- Configuration identity
  "configuration_key" varchar(100) NOT NULL,
  "configuration_label" varchar(255),
  
  -- Wheel specification
  "wheel_diameter" integer NOT NULL,
  "wheel_width" decimal(4, 1),
  "wheel_offset_mm" decimal(5, 1),
  
  -- Tire specification
  "tire_size" varchar(50) NOT NULL,
  
  -- Position (for staggered setups)
  "axle_position" varchar(10) NOT NULL DEFAULT 'square',
  
  -- Configuration flags
  "is_default" boolean NOT NULL DEFAULT false,
  "is_optional" boolean NOT NULL DEFAULT false,
  
  -- Source and confidence
  "source" varchar(50) NOT NULL,
  "source_confidence" varchar(20) NOT NULL DEFAULT 'low',
  "source_notes" text,
  
  -- Metadata
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "fitment_configs_fitment_id_idx" 
  ON "vehicle_fitment_configurations" ("vehicle_fitment_id");

CREATE INDEX IF NOT EXISTS "fitment_configs_vehicle_lookup_idx" 
  ON "vehicle_fitment_configurations" ("year", "make_key", "model_key");

CREATE INDEX IF NOT EXISTS "fitment_configs_wheel_dia_idx" 
  ON "vehicle_fitment_configurations" ("year", "make_key", "model_key", "wheel_diameter");

-- Unique constraint to prevent duplicate configs
CREATE UNIQUE INDEX IF NOT EXISTS "fitment_configs_unique_idx" 
  ON "vehicle_fitment_configurations" ("year", "make_key", "model_key", "modification_id", "configuration_key", "axle_position");

-- Comment for documentation
COMMENT ON TABLE "vehicle_fitment_configurations" IS 
  'Exact OEM wheel+tire configuration pairings. Shadow layer for migration from aggregated arrays.';
