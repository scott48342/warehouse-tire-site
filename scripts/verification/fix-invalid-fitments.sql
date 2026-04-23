-- ============================================================
-- FITMENT DATA FIXES - Generated from Verification Audit
-- Date: 2026-04-23
-- Total Invalid Records: 206
-- ============================================================

-- ============================================================
-- 1. CHEVROLET ASTRO - Wrong bolt pattern (6x139.7 → 5x127)
-- Astro (1985-2004) uses 5x127 (5x5"), NOT 6x139.7
-- Only AWD Astros 2003-2005 used 6x139.7
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x127',
  hub_bore = 78.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Astro'
  AND year BETWEEN 1985 AND 2002
  AND bolt_pattern = '6x139.7';

-- Second gen (1995-2005) had slightly different hub bore
UPDATE vehicle_fitments 
SET hub_bore = 78.1
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Astro'
  AND year BETWEEN 1995 AND 2004
  AND bolt_pattern = '5x127';

-- ============================================================
-- 2. CHEVROLET S10 - Wrong bolt pattern (6x139.7 → 5x120.65)
-- S10 (1982-2004) uses 5x120.65 (5x4.75"), NOT 6x139.7
-- Hub bore is 70.3mm, NOT 78.1mm
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  hub_bore = 70.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'S10'
  AND model NOT ILIKE '%Blazer%'
  AND year BETWEEN 1982 AND 2004
  AND bolt_pattern = '6x139.7';

-- ============================================================
-- 3. CHEVROLET S10 BLAZER - Wrong bolt pattern (6x139.7 → 5x120.65)
-- S10 Blazer (1983-2005) uses 5x120.65, NOT 6x139.7
-- Hub bore is 70.3mm, NOT 78.1mm
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  hub_bore = 70.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE '%S10%Blazer%'
  AND year BETWEEN 1983 AND 2005
  AND bolt_pattern = '6x139.7';

-- Also catch "Blazer" entries that are actually S10 Blazers (1983-2005)
-- Full-size Blazer (1969-1994) DID use 6x139.7, so be careful
UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  hub_bore = 70.3
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Blazer'
  AND year BETWEEN 1995 AND 2005  -- After full-size ended, all Blazers are S10-based
  AND bolt_pattern = '6x139.7';

-- ============================================================
-- 4. GMC SAFARI - Same issue as Astro (same platform)
-- Safari (1985-2005) uses 5x127, NOT 6x139.7
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x127',
  hub_bore = 78.1
WHERE make ILIKE 'GMC' 
  AND model ILIKE 'Safari'
  AND year BETWEEN 1985 AND 2005
  AND bolt_pattern = '6x139.7';

-- ============================================================
-- 5. GMC S15/SONOMA - Same as S10 (same platform)
-- S15 (1982-1990) / Sonoma (1991-2004) uses 5x120.65
-- ============================================================

UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  hub_bore = 70.3
WHERE make ILIKE 'GMC' 
  AND (model ILIKE 'S15' OR model ILIKE 'Sonoma')
  AND year BETWEEN 1982 AND 2004
  AND bolt_pattern = '6x139.7';

-- GMC Jimmy (S-series based, 1983-2005) also 5x120.65
UPDATE vehicle_fitments 
SET 
  bolt_pattern = '5x120.65',
  hub_bore = 70.3
WHERE make ILIKE 'GMC' 
  AND model ILIKE 'Jimmy'
  AND year BETWEEN 1995 AND 2005  -- Post full-size Jimmy
  AND bolt_pattern = '6x139.7';

-- ============================================================
-- 6. PHANTOM MODELS - Delete or rename
-- "Silverado" was not a model until 1999 (was a trim on C/K)
-- ============================================================

-- Option A: Delete phantom Silverado entries (pre-1999)
-- Uncomment to execute:
-- DELETE FROM vehicle_fitments 
-- WHERE make ILIKE 'Chevrolet' 
--   AND model ILIKE 'Silverado%'
--   AND year < 1999;

-- Option B: Rename to correct model name
-- You'd need to determine 2WD vs 4WD per record
-- For now, flag them for manual review:
UPDATE vehicle_fitments 
SET notes = COALESCE(notes, '') || ' [REVIEW: Pre-1999 Silverado should be C/K series]'
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Silverado%'
  AND year < 1999
  AND (notes IS NULL OR notes NOT LIKE '%REVIEW%');

-- ============================================================
-- 7. VERIFICATION COUNTS - Run after fixes
-- ============================================================

-- Check Astro fix
SELECT 'Astro' as model, bolt_pattern, COUNT(*) 
FROM vehicle_fitments 
WHERE make ILIKE 'Chevrolet' AND model ILIKE 'Astro'
GROUP BY bolt_pattern;

-- Check S10 fix
SELECT 'S10' as model, bolt_pattern, COUNT(*) 
FROM vehicle_fitments 
WHERE make ILIKE 'Chevrolet' AND model ILIKE 'S10'
GROUP BY bolt_pattern;

-- Check pre-1999 Silverado
SELECT year, model, COUNT(*) 
FROM vehicle_fitments 
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Silverado%'
  AND year < 1999
GROUP BY year, model
ORDER BY year;
