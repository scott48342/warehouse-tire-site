-- ============================================================
-- PHASE 4: VALIDATE CLEANUP
-- Run after all cleanup scripts to verify data quality
-- ============================================================

-- Overall counts
SELECT 'OVERALL DATABASE STATUS' as section;
SELECT COUNT(*) as total_records FROM vehicle_fitments;
SELECT COUNT(DISTINCT make) as unique_makes FROM vehicle_fitments;
SELECT COUNT(DISTINCT model) as unique_models FROM vehicle_fitments;
SELECT MIN(year) as min_year, MAX(year) as max_year FROM vehicle_fitments;

-- Check for remaining empty tire sizes
SELECT 'REMAINING EMPTY TIRE SIZES' as section;
SELECT make, model, year, COUNT(*) as empty_count
FROM vehicle_fitments
WHERE oem_tire_sizes IS NULL 
   OR oem_tire_sizes = '[]'::jsonb 
   OR oem_tire_sizes::text = '[]'
   OR jsonb_array_length(oem_tire_sizes) = 0
GROUP BY make, model, year
ORDER BY make, model, year
LIMIT 50;

-- Check for potential phantom years (vehicles with gaps)
SELECT 'POTENTIAL PHANTOM YEARS CHECK' as section;
SELECT make, model, 
       MIN(year) as first_year, 
       MAX(year) as last_year,
       COUNT(*) as year_count,
       MAX(year) - MIN(year) + 1 - COUNT(*) as missing_years
FROM vehicle_fitments
GROUP BY make, model
HAVING MAX(year) - MIN(year) + 1 > COUNT(*)
ORDER BY missing_years DESC
LIMIT 30;

-- Check for potential non-US models remaining
SELECT 'POTENTIAL NON-US MODELS CHECK' as section;
SELECT make, model, COUNT(*) as records
FROM vehicle_fitments
WHERE model ~* '(jdm|japan|euro|europe|asia|china|mexico|canada|uk|australia)'
   OR model ~* '(harrier|hilux|celsior|aristo|altezza|crown|mark)'
   OR model ~* '(lavida|sagitar|bora|touran|polo|sharan|lupo)'
GROUP BY make, model
ORDER BY records DESC
LIMIT 30;

-- Sample tire sizes by make (spot check)
SELECT 'SAMPLE TIRE SIZES BY MAKE' as section;
SELECT make, model, year, oem_tire_sizes
FROM vehicle_fitments
WHERE year = 2024
ORDER BY make, model
LIMIT 50;

-- Check high-volume vehicles have correct data
SELECT 'HIGH-VOLUME VEHICLE VALIDATION' as section;
SELECT make, model, year, oem_tire_sizes
FROM vehicle_fitments
WHERE (make, model) IN (
  ('Toyota', 'Camry'),
  ('Toyota', 'Corolla'),
  ('Toyota', 'RAV4'),
  ('Toyota', 'Highlander'),
  ('Honda', 'Civic'),
  ('Honda', 'Accord'),
  ('Honda', 'CR-V'),
  ('Ford', 'F-150'),
  ('Chevrolet', 'Silverado'),
  ('Nissan', 'Altima')
)
AND year BETWEEN 2022 AND 2024
ORDER BY make, model, year;

-- Verify key corrections were applied
SELECT 'KEY CORRECTION VERIFICATION' as section;

-- Corolla Cross should have 215/65R17, 225/55R18
SELECT 'Corolla Cross check:' as vehicle, make, model, year, oem_tire_sizes
FROM vehicle_fitments
WHERE make ILIKE 'Toyota' AND model ILIKE 'Corolla Cross' AND year = 2024;

-- GR Corolla should have 235/40R18
SELECT 'GR Corolla check:' as vehicle, make, model, year, oem_tire_sizes
FROM vehicle_fitments
WHERE make ILIKE 'Toyota' AND model ILIKE '%GR%Corolla%' AND year = 2024;

-- Prius Gen 5 should have 195/60R17, 195/50R19
SELECT 'Prius 2024 check:' as vehicle, make, model, year, oem_tire_sizes
FROM vehicle_fitments
WHERE make ILIKE 'Toyota' AND model ILIKE 'Prius' AND model NOT ILIKE '%Prime%' AND year = 2024;

-- GTI should have 235/35R19
SELECT 'GTI check:' as vehicle, make, model, year, oem_tire_sizes
FROM vehicle_fitments
WHERE make ILIKE 'Volkswagen' AND model ILIKE 'GTI' AND year = 2024;

-- Volvo XC90 Gen 1 should NOT have Gen 2 sizes
SELECT 'XC90 2010 check (Gen 1):' as vehicle, make, model, year, oem_tire_sizes
FROM vehicle_fitments
WHERE make ILIKE 'Volvo' AND model ILIKE 'XC90' AND year = 2010;

-- Final summary
SELECT 'CLEANUP COMPLETE' as status,
       (SELECT COUNT(*) FROM vehicle_fitments) as total_records,
       (SELECT COUNT(*) FROM vehicle_fitments WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb) as empty_records;
