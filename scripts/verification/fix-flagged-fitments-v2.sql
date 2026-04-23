-- ============================================================
-- FLAGGED FITMENT FIXES v2 - Vintage Tire Contamination
-- Date: 2026-04-23
-- ============================================================

-- ============================================================
-- 1. CAMARO 1967-1981 - Remove modern tire sizes
-- ============================================================

-- First gen Camaro (1967-1969)
UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P205/70R14", "P215/70R14", "P225/70R14"]'::jsonb
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Camaro'
  AND year BETWEEN 1967 AND 1969
  AND oem_tire_sizes::text ILIKE '%R20%';

-- Second gen Camaro (1970-1981)
UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P215/65R15", "P225/70R15", "P235/60R15", "P245/60R15"]'::jsonb
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Camaro'
  AND year BETWEEN 1970 AND 1981
  AND oem_tire_sizes::text ILIKE '%R20%';

-- ============================================================
-- 2. CHEVELLE 1964-1977 - Fix tire sizes
-- ============================================================

UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P215/70R14", "P225/70R15", "P235/70R15"]'::jsonb
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Chevelle'
  AND year BETWEEN 1964 AND 1977
  AND (oem_tire_sizes::text ILIKE '%R20%' OR oem_tire_sizes::text ILIKE '%R19%');

-- ============================================================
-- 3. CORVETTE vintage - Fix tire sizes
-- ============================================================

-- C2 Corvette (1963-1967)
UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P205/75R15", "P215/70R15", "P225/70R15"]'::jsonb
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND year BETWEEN 1963 AND 1967
  AND (oem_tire_sizes::text ILIKE '%R20%' OR oem_tire_sizes::text ILIKE '%R19%');

-- C3 Corvette (1968-1982)
UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P225/70R15", "P235/60R15", "P255/60R15"]'::jsonb
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND year BETWEEN 1968 AND 1982
  AND (oem_tire_sizes::text ILIKE '%R20%' OR oem_tire_sizes::text ILIKE '%R19%');

-- C4 Corvette (1984-1996)
UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P255/50R16", "P275/40R17", "P315/35R17"]'::jsonb
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND year BETWEEN 1984 AND 1996
  AND oem_tire_sizes::text ILIKE '%R20%';

-- ============================================================
-- 4. CAPRICE 1965-1990 - Fix tire sizes
-- ============================================================

UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P205/75R15", "P215/70R15", "P225/70R15"]'::jsonb
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Caprice'
  AND year BETWEEN 1965 AND 1990
  AND (oem_tire_sizes::text ILIKE '%R20%' OR oem_tire_sizes::text ILIKE '%R19%');

-- ============================================================
-- 5. Delete invalid Corvette Z51 trims (pre-1984)
-- ============================================================

DELETE FROM vehicle_fitments 
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND display_trim ILIKE '%Z51%'
  AND year < 1984;
