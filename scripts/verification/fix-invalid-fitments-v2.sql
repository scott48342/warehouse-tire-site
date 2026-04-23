-- ============================================================
-- FITMENT DATA FIXES v2 - Correct column names
-- Date: 2026-04-23
-- ============================================================

-- ============================================================
-- 1. CHEVROLET ASTRO - Wrong bolt pattern (6x139.7 → 5x127)
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x127',
  center_bore_mm = 78.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Astro'
  AND year BETWEEN 1985 AND 2002
  AND bolt_pattern = '6x139.7';

-- Second gen hub bore adjustment
UPDATE vehicle_fitments 
SET center_bore_mm = 78.1
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Astro'
  AND year BETWEEN 1995 AND 2004
  AND bolt_pattern = '5x127';

-- ============================================================
-- 2. CHEVROLET S10 - Wrong bolt pattern (6x139.7 → 5x120.65)
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  center_bore_mm = 70.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'S10'
  AND model NOT ILIKE '%Blazer%'
  AND year BETWEEN 1982 AND 2004
  AND bolt_pattern = '6x139.7';

-- ============================================================
-- 3. CHEVROLET S10 BLAZER - Wrong bolt pattern
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  center_bore_mm = 70.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE '%S10%Blazer%'
  AND year BETWEEN 1983 AND 2005
  AND bolt_pattern = '6x139.7';

-- Catch Blazer entries that are S10-based (1995+)
UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  center_bore_mm = 70.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Blazer'
  AND year BETWEEN 1995 AND 2005
  AND bolt_pattern = '6x139.7';

-- ============================================================
-- 4. GMC SAFARI - Same as Astro
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x127',
  center_bore_mm = 78.1
WHERE make ILIKE 'GMC' 
  AND model ILIKE 'Safari'
  AND year BETWEEN 1985 AND 2005
  AND bolt_pattern = '6x139.7';

-- ============================================================
-- 5. GMC S15/SONOMA/JIMMY - Same as S10
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  center_bore_mm = 70.3
WHERE make ILIKE 'GMC' 
  AND (model ILIKE 'S15' OR model ILIKE 'Sonoma' OR model ILIKE 'Jimmy')
  AND year BETWEEN 1982 AND 2005
  AND bolt_pattern = '6x139.7';
