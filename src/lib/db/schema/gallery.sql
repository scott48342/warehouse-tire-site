-- ============================================================================
-- gallery_images - User-submitted and imported build images
-- ============================================================================
-- 
-- PURPOSE: Store wheel/tire build images linked to vehicle fitments
-- for "See builds like this" feature during wheel selection.
--
-- DATA SOURCES:
-- 1. WheelPros/Fitment Industries Gallery (imported)
-- 2. Customer submissions (future)
-- 3. Manual curator uploads (future)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Image
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  blob_url TEXT, -- Our cached copy (Vercel Blob)
  
  -- Source tracking
  source VARCHAR(50) NOT NULL, -- 'fitment_industries', 'customer', 'curator'
  source_id VARCHAR(255), -- External gallery ID (e.g., FI gallery ID)
  source_url TEXT, -- Original source page URL
  
  -- Vehicle (normalized for matching)
  vehicle_year INTEGER NOT NULL,
  vehicle_make VARCHAR(100) NOT NULL,
  vehicle_model VARCHAR(100) NOT NULL,
  vehicle_trim VARCHAR(255),
  vehicle_key VARCHAR(255) GENERATED ALWAYS AS (
    LOWER(vehicle_make || '_' || vehicle_model)
  ) STORED,
  
  -- Wheel specs
  wheel_brand VARCHAR(100),
  wheel_model VARCHAR(200),
  wheel_diameter INTEGER, -- 18, 20, 22, etc.
  wheel_width DECIMAL(4, 1), -- 9.5, 10, etc.
  wheel_offset_mm INTEGER, -- +35, -12, etc.
  wheel_finish VARCHAR(100), -- Black, Chrome, Bronze, etc.
  
  -- Rear wheel (for staggered)
  rear_wheel_diameter INTEGER,
  rear_wheel_width DECIMAL(4, 1),
  rear_wheel_offset_mm INTEGER,
  is_staggered BOOLEAN GENERATED ALWAYS AS (
    rear_wheel_diameter IS NOT NULL OR rear_wheel_width IS NOT NULL
  ) STORED,
  
  -- Tire specs
  tire_brand VARCHAR(100),
  tire_model VARCHAR(200),
  tire_size VARCHAR(50), -- "275/55R20"
  rear_tire_size VARCHAR(50), -- For staggered
  
  -- Suspension/Lift
  suspension_type VARCHAR(30), -- 'stock', 'lowering_springs', 'coilovers', 'air', 'lift_kit'
  suspension_brand VARCHAR(100),
  lift_level VARCHAR(30), -- 'stock', 'leveled', 'lifted_2', 'lifted_4', 'lifted_6', 'lowered', 'slammed'
  
  -- Fitment style (from FI gallery)
  fitment_type VARCHAR(30), -- 'flush', 'hellaflush', 'nearly_flush', 'poke', 'tucked'
  
  -- Spacers
  spacer_size_mm INTEGER, -- null = no spacers
  rear_spacer_size_mm INTEGER,
  
  -- Build style (for filtering)
  build_style VARCHAR(30), -- 'aggressive', 'daily', 'show', 'offroad', 'drift'
  
  -- Metadata
  title VARCHAR(255),
  description TEXT,
  tags TEXT[], -- ['lifted', 'method_wheels', 'ko2_tires']
  
  -- Engagement
  view_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'pending', 'hidden', 'flagged'
  moderated_at TIMESTAMP,
  moderated_by VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  imported_at TIMESTAMP
);

-- ============================================================================
-- Indexes for gallery_images
-- ============================================================================

-- Vehicle lookup (primary use case)
CREATE INDEX IF NOT EXISTS gallery_images_vehicle_idx 
  ON gallery_images (vehicle_year, vehicle_make, vehicle_model);

-- Make/model browsing
CREATE INDEX IF NOT EXISTS gallery_images_make_model_idx 
  ON gallery_images (vehicle_key);

-- Wheel diameter filtering (for build flow)
CREATE INDEX IF NOT EXISTS gallery_images_wheel_diameter_idx 
  ON gallery_images (wheel_diameter, vehicle_key);

-- Lift level filtering (for truck builds)
CREATE INDEX IF NOT EXISTS gallery_images_lift_idx 
  ON gallery_images (lift_level, vehicle_key);

-- Source deduplication
CREATE UNIQUE INDEX IF NOT EXISTS gallery_images_source_idx 
  ON gallery_images (source, source_id) WHERE source_id IS NOT NULL;

-- Featured/active filtering
CREATE INDEX IF NOT EXISTS gallery_images_status_idx 
  ON gallery_images (status, featured);

-- Wheel brand browsing
CREATE INDEX IF NOT EXISTS gallery_images_wheel_brand_idx 
  ON gallery_images (wheel_brand) WHERE wheel_brand IS NOT NULL;

-- ============================================================================
-- gallery_image_likes - Track user engagement (future)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gallery_image_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_image_id UUID NOT NULL REFERENCES gallery_images(id) ON DELETE CASCADE,
  user_session_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(gallery_image_id, user_session_id)
);

-- ============================================================================
-- Example queries
-- ============================================================================

-- Find builds matching user's vehicle and selected wheel diameter
-- SELECT * FROM gallery_images 
-- WHERE vehicle_make ILIKE 'Ford' 
--   AND vehicle_model ILIKE 'F-150%'
--   AND vehicle_year BETWEEN 2021 AND 2023
--   AND wheel_diameter = 20
--   AND lift_level = 'leveled'
--   AND status = 'active'
-- ORDER BY featured DESC, view_count DESC
-- LIMIT 6;
