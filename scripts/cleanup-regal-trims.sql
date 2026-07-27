-- BUICK REGAL TRIM CLEANUP
-- Problem: Modern trims (Sportback, TourX, GS, Essence, Preferred) were applied to ALL years
-- Reality: These trims only exist for 2018+ (6th generation Regal)
-- 
-- Generations:
-- - 1st gen: 1973-1977
-- - 2nd gen: 1978-1987  
-- - 3rd gen: 1988-1996
-- - 4th gen: 1997-2004
-- - 5th gen: 2011-2017 (GS existed here too, but different platform)
-- - 6th gen: 2018-2020 (Sportback, TourX, GS, Essence, Preferred)

-- Find affected records
SELECT year, display_trim, modification_id, bolt_pattern, offset_range
FROM vehicle_fitments
WHERE make = 'Buick' 
  AND model = 'Regal'
  AND year < 2018
  AND display_trim IN ('Sportback', 'TourX')
ORDER BY year, display_trim;

-- Count affected records  
SELECT COUNT(*) as affected_count
FROM vehicle_fitments
WHERE make = 'Buick' 
  AND model = 'Regal'
  AND year < 2018
  AND display_trim IN ('Sportback', 'TourX');

-- DELETE the incorrectly-dated records
-- Sportback and TourX are 2018+ ONLY body styles (not trims for older Regals)
DELETE FROM vehicle_fitments
WHERE make = 'Buick' 
  AND model = 'Regal'
  AND year < 2018
  AND display_trim IN ('Sportback', 'TourX');

-- GS existed in 5th gen (2011-2017) but with different specs
-- For now, leave GS alone - it's more complex
-- The GS in years < 2011 is definitely wrong though

-- Find GS records in years where GS didn't exist
SELECT year, display_trim, modification_id, bolt_pattern, offset_range
FROM vehicle_fitments
WHERE make = 'Buick' 
  AND model = 'Regal'
  AND display_trim = 'GS'
  AND year < 2011
ORDER BY year;
