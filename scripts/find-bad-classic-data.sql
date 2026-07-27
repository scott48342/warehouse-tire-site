-- Find records where year < 1985 but display_trim looks modern
-- (GS, Sportback, TourX are 2018+ Regal trims)

SELECT 
  year,
  make,
  model,
  display_trim,
  modification_id,
  bolt_pattern,
  offset_range,
  center_bore_mm
FROM vehicle_fitments
WHERE year < 1990
  AND make = 'Buick'
  AND model = 'Regal'
ORDER BY year, display_trim;

-- Also check for any pre-1985 records with null/empty offset
SELECT 
  year,
  make,
  model,
  display_trim,
  bolt_pattern,
  offset_range,
  center_bore_mm
FROM vehicle_fitments
WHERE year < 1985
  AND (offset_range IS NULL OR offset_range = '' OR offset_range = '{}')
ORDER BY make, model, year;
