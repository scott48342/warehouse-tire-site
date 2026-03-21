-- Migration: Change offset columns from integer to decimal
-- Reason: Wheel-Size API returns decimal offsets like 44.45mm
-- Tables affected: vehicle_fitments, fitment_overrides

-- vehicle_fitments table
ALTER TABLE vehicle_fitments 
  ALTER COLUMN offset_min_mm TYPE decimal(5,2) USING offset_min_mm::decimal(5,2);

ALTER TABLE vehicle_fitments 
  ALTER COLUMN offset_max_mm TYPE decimal(5,2) USING offset_max_mm::decimal(5,2);

-- fitment_overrides table
ALTER TABLE fitment_overrides 
  ALTER COLUMN offset_min_mm TYPE decimal(5,2) USING offset_min_mm::decimal(5,2);

ALTER TABLE fitment_overrides 
  ALTER COLUMN offset_max_mm TYPE decimal(5,2) USING offset_max_mm::decimal(5,2);
