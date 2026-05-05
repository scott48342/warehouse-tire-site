-- OEM Package Choices Migration
-- Provides customer-friendly package labels for multi-config trims

CREATE TABLE IF NOT EXISTS oem_package_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vehicle identification (matches wheel_size_trim_mappings)
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  trim VARCHAR(200) NOT NULL,
  
  -- Package display info
  package_label VARCHAR(300) NOT NULL,
  package_description TEXT,
  
  -- Fitment specs
  wheel_diameter INTEGER NOT NULL,
  rim_width NUMERIC(4,1),
  tire_size VARCHAR(50) NOT NULL,
  tire_size_rear VARCHAR(50),
  load_rating VARCHAR(10),
  
  -- Metadata
  source VARCHAR(100) NOT NULL DEFAULT 'manual',
  confidence VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(100),
  
  -- Ensure unique package per YMM/trim/diameter
  CONSTRAINT unique_package_choice UNIQUE (year, make, model, trim, wheel_diameter)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_oem_package_choices_ymmt 
  ON oem_package_choices(year, make, model, trim);

CREATE INDEX IF NOT EXISTS idx_oem_package_choices_status 
  ON oem_package_choices(status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_oem_package_choices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oem_package_choices_updated_at ON oem_package_choices;
CREATE TRIGGER oem_package_choices_updated_at
  BEFORE UPDATE ON oem_package_choices
  FOR EACH ROW
  EXECUTE FUNCTION update_oem_package_choices_updated_at();

-- Seed pilot data for 2024 RAM 1500 Big Horn
INSERT INTO oem_package_choices (year, make, model, trim, package_label, wheel_diameter, tire_size, source, confidence, status, display_order, notes)
VALUES 
  (2024, 'Ram', '1500', 'Big Horn', '18" Standard Big Horn', 18, '275/65R18', 'wheel-size-verification', 'high', 'pending', 1, 'Verified via Wheel-Size API 2026-05-05. Standard factory config.'),
  (2024, 'Ram', '1500', 'Big Horn', '20" Sport / Night / Off-Road Package', 20, '275/55R20', 'wheel-size-verification', 'high', 'pending', 2, 'Verified via Wheel-Size API 2026-05-05. Optional package upgrade.')
ON CONFLICT (year, make, model, trim, wheel_diameter) DO UPDATE SET
  package_label = EXCLUDED.package_label,
  tire_size = EXCLUDED.tire_size,
  source = EXCLUDED.source,
  confidence = EXCLUDED.confidence,
  notes = EXCLUDED.notes,
  updated_at = NOW();
