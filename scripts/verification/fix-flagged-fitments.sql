-- ============================================================
-- FLAGGED FITMENT FIXES - Vintage Vehicle Tire Contamination
-- Date: 2026-04-23
-- ============================================================

-- ============================================================
-- 1. CAMARO 1967-1981 (First & Second Gen) - Remove modern tire sizes
-- These cars came with 14" and 15" wheels, NOT 20"
-- ============================================================

-- First gen Camaro (1967-1969) - 14" wheels standard
UPDATE vehicle_fitments 
SET tire_sizes = ARRAY['E70-14', 'F70-14', 'P205/70R14', 'P215/70R14']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Camaro'
  AND year BETWEEN 1967 AND 1969
  AND (tire_sizes::text ILIKE '%R20%' OR tire_sizes::text ILIKE '%R19%');

-- Second gen Camaro (1970-1981) - 15" wheels common
UPDATE vehicle_fitments 
SET tire_sizes = ARRAY['P215/65R15', 'P225/70R15', 'P235/60R15', 'P245/60R15']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Camaro'
  AND year BETWEEN 1970 AND 1981
  AND (tire_sizes::text ILIKE '%R20%' OR tire_sizes::text ILIKE '%R19%');

-- ============================================================
-- 2. CHEVELLE 1964-1977 - Remove modern tire sizes
-- ============================================================

UPDATE vehicle_fitments 
SET tire_sizes = ARRAY['E70-14', 'F70-14', 'G70-14', 'P215/70R14', 'P225/70R15']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Chevelle'
  AND year BETWEEN 1964 AND 1977
  AND (tire_sizes::text ILIKE '%R20%' OR tire_sizes::text ILIKE '%R19%' OR tire_sizes::text ILIKE '%R18%');

-- ============================================================
-- 3. CORVETTE 1963-1982 (C2/C3) - Remove modern tire sizes
-- ============================================================

-- C2 Corvette (1963-1967) - 15" wheels
UPDATE vehicle_fitments 
SET tire_sizes = ARRAY['P205/75R15', 'P215/70R15', 'P225/70R15']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND year BETWEEN 1963 AND 1967
  AND (tire_sizes::text ILIKE '%R20%' OR tire_sizes::text ILIKE '%R19%' OR tire_sizes::text ILIKE '%R18%');

-- C3 Corvette (1968-1982) - 15" wheels, later years 16"
UPDATE vehicle_fitments 
SET tire_sizes = ARRAY['P225/70R15', 'P235/60R15', 'P255/60R15']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND year BETWEEN 1968 AND 1982
  AND (tire_sizes::text ILIKE '%R20%' OR tire_sizes::text ILIKE '%R19%' OR tire_sizes::text ILIKE '%R18%');

-- C4 Corvette (1984-1996) - 16" standard, 17" on ZR-1
UPDATE vehicle_fitments 
SET tire_sizes = ARRAY['P255/50R16', 'P275/40R17', 'P315/35R17']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND year BETWEEN 1984 AND 1996
  AND (tire_sizes::text ILIKE '%R20%' OR tire_sizes::text ILIKE '%R19%');

-- ============================================================
-- 4. CORVETTE - Remove invalid trim/year combos
-- Z51 didn't exist before 1984
-- ============================================================

DELETE FROM vehicle_fitments 
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Corvette'
  AND trim ILIKE '%Z51%'
  AND year < 1984;

-- ============================================================
-- 5. CAPRICE 1965-1996 - Fix tire sizes
-- ============================================================

UPDATE vehicle_fitments 
SET tire_sizes = ARRAY['P205/75R15', 'P215/70R15', 'P225/70R15', 'P235/70R15']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model ILIKE 'Caprice'
  AND year BETWEEN 1965 AND 1990
  AND (tire_sizes::text ILIKE '%R20%' OR tire_sizes::text ILIKE '%R19%' OR tire_sizes::text ILIKE '%R18%');

-- ============================================================
-- 6. C20/C2500 - Fix wheel diameter (15" not 16" for pre-1988)
-- ============================================================

UPDATE vehicle_fitments 
SET wheel_sizes = ARRAY['15x6', '15x7', '15x8']::text[]
WHERE make ILIKE 'Chevrolet' 
  AND model IN ('C20', 'K20')
  AND year BETWEEN 1967 AND 1987
  AND wheel_sizes::text ILIKE '%16x%';

-- ============================================================
-- 7. Remove false-positive Hummer flags (no changes needed)
-- Hummer H1/H2 correctly use 8-lug bolt pattern
-- ============================================================
-- No action needed - data is correct

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check Camaro fixes
SELECT year, model, trim, tire_sizes 
FROM vehicle_fitments 
WHERE make ILIKE 'Chevrolet' AND model ILIKE 'Camaro' AND year < 1982
ORDER BY year LIMIT 10;

-- Check Corvette fixes
SELECT year, model, trim, tire_sizes 
FROM vehicle_fitments 
WHERE make ILIKE 'Chevrolet' AND model ILIKE 'Corvette' AND year < 1997
ORDER BY year LIMIT 10;
