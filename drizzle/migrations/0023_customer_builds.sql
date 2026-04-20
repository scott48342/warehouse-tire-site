-- Customer Builds Submission System
-- Allows customers to submit photos of their builds for gallery inclusion
-- Part of the user-generated content strategy

-- Main submissions table
CREATE TABLE IF NOT EXISTS customer_builds (
  id SERIAL PRIMARY KEY,
  
  -- Submission tracking
  submission_id VARCHAR(36) NOT NULL UNIQUE,  -- UUID for public reference
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | flagged
  
  -- Customer info
  customer_email VARCHAR(255),
  customer_name VARCHAR(100),
  order_id VARCHAR(50),                        -- Link to original order if available
  
  -- Vehicle info
  vehicle_year INTEGER,
  vehicle_make VARCHAR(50),
  vehicle_model VARCHAR(100),
  vehicle_trim VARCHAR(100),
  vehicle_type VARCHAR(30),                    -- truck | suv | jeep | car
  
  -- Build details
  lift_type VARCHAR(30),                       -- stock | leveled | lifted
  lift_inches DECIMAL(4,1),                    -- e.g., 2.5, 4, 6
  lift_brand VARCHAR(100),                     -- e.g., "Rough Country", "BDS"
  stance VARCHAR(30),                          -- flush | poke | tucked | aggressive
  
  -- Wheel info
  wheel_brand VARCHAR(100),
  wheel_model VARCHAR(100),
  wheel_sku VARCHAR(50),
  wheel_diameter VARCHAR(10),                  -- e.g., "20"
  wheel_width VARCHAR(10),                     -- e.g., "10"
  wheel_offset VARCHAR(10),                    -- e.g., "-24"
  wheel_finish VARCHAR(100),
  
  -- Tire info
  tire_brand VARCHAR(100),
  tire_model VARCHAR(100),
  tire_size VARCHAR(30),                       -- e.g., "35x12.50R20"
  
  -- Customer notes
  build_notes TEXT,                            -- Customer's description of build
  instagram_handle VARCHAR(100),               -- Optional social media
  
  -- Moderation
  moderator_notes TEXT,                        -- Internal notes
  moderated_by VARCHAR(100),
  moderated_at TIMESTAMPTZ,
  rejection_reason VARCHAR(255),
  
  -- Feature flags
  is_featured BOOLEAN DEFAULT false,           -- Manually featured build
  feature_priority INTEGER DEFAULT 0,          -- Higher = shown first
  
  -- Consent
  consent_gallery BOOLEAN DEFAULT false,       -- Agreed to gallery usage
  consent_marketing BOOLEAN DEFAULT false,     -- Agreed to marketing usage
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer build images
CREATE TABLE IF NOT EXISTS customer_build_images (
  id SERIAL PRIMARY KEY,
  build_id INTEGER NOT NULL REFERENCES customer_builds(id) ON DELETE CASCADE,
  
  -- Image storage
  original_url TEXT NOT NULL,                  -- Original uploaded URL
  cdn_url TEXT,                                -- CDN-optimized URL
  thumbnail_url TEXT,                          -- Thumbnail for previews
  
  -- Image metadata
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type VARCHAR(50),
  
  -- Image classification
  angle VARCHAR(30),                           -- front | side | rear | interior | wheel_detail | other
  is_primary BOOLEAN DEFAULT false,            -- Main hero image
  
  -- Moderation
  is_approved BOOLEAN DEFAULT true,            -- Individual image approval
  moderation_notes TEXT,
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_builds_status 
  ON customer_builds(status);

CREATE INDEX IF NOT EXISTS idx_customer_builds_vehicle 
  ON customer_builds(vehicle_make, vehicle_model);

CREATE INDEX IF NOT EXISTS idx_customer_builds_wheel 
  ON customer_builds(wheel_brand, wheel_model);

CREATE INDEX IF NOT EXISTS idx_customer_builds_order 
  ON customer_builds(order_id);

CREATE INDEX IF NOT EXISTS idx_customer_builds_email 
  ON customer_builds(customer_email);

CREATE INDEX IF NOT EXISTS idx_customer_builds_featured 
  ON customer_builds(is_featured, feature_priority DESC);

CREATE INDEX IF NOT EXISTS idx_customer_build_images_build 
  ON customer_build_images(build_id);

CREATE INDEX IF NOT EXISTS idx_customer_build_images_primary 
  ON customer_build_images(build_id, is_primary);

-- View for approved builds (used by gallery matching)
CREATE OR REPLACE VIEW approved_customer_builds AS
SELECT 
  cb.*,
  (
    SELECT cbi.thumbnail_url 
    FROM customer_build_images cbi 
    WHERE cbi.build_id = cb.id AND cbi.is_primary = true 
    LIMIT 1
  ) as primary_thumbnail,
  (
    SELECT cbi.cdn_url 
    FROM customer_build_images cbi 
    WHERE cbi.build_id = cb.id AND cbi.is_primary = true 
    LIMIT 1
  ) as primary_image
FROM customer_builds cb
WHERE cb.status = 'approved';
