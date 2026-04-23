-- ============================================================
-- PHASE 4: DELETE ADDITIONAL NON-US VEHICLES
-- Models identified in gap analysis
-- ============================================================

BEGIN;

-- Count before
SELECT 'BEFORE' as status, COUNT(*) as total FROM vehicle_fitments;

-- Delete additional non-US models
DELETE FROM vehicle_fitments
WHERE 
  -- Mazda non-US
  (make ILIKE 'Mazda' AND model ILIKE 'CX-4')
  OR (make ILIKE 'Mazda' AND model ILIKE 'CX-8')
  OR (make ILIKE 'Mazda' AND model ILIKE 'Mazda8')
  OR (make ILIKE 'Mazda' AND model ILIKE 'Roadster%')
  OR (make ILIKE 'Mazda' AND model ILIKE 'MX-5-RF')
  -- Nissan non-US
  OR (make ILIKE 'Nissan' AND model ILIKE 'Lannia')
  OR (make ILIKE 'Nissan' AND model ILIKE 'V-Drive')
  OR (make ILIKE 'Nissan' AND model ILIKE 'Dayz%')
  OR (make ILIKE 'Nissan' AND model ILIKE 'NP300%')
  OR (make ILIKE 'Nissan' AND model ILIKE 'Micra%')
  -- Ram LATAM
  OR (make ILIKE 'Ram' AND model ILIKE 'V1000')
  OR (make ILIKE 'Ram' AND model ILIKE 'V700%')
  OR (make ILIKE 'Ram' AND model ILIKE '1000')
  OR (make ILIKE 'Ram' AND model ILIKE 'ProMaster-Rapid')
  OR (make ILIKE 'Ram' AND model ILIKE 'ProMaster Rapid')
  -- Chevrolet LATAM
  OR (make ILIKE 'Chevrolet' AND model ILIKE 'Move%')
  OR (make ILIKE 'Chevrolet' AND model ILIKE 'T-Series')
  -- Kia Europe
  OR (make ILIKE 'Kia' AND model ILIKE 'Pro-Cee%')
  OR (make ILIKE 'Kia' AND model ILIKE 'Pro Cee%')
  OR (make ILIKE 'Kia' AND model ILIKE 'ProCeed')
  -- Subaru JDM naming
  OR (make ILIKE 'Subaru' AND model ILIKE 'Legacy-B4')
  OR (make ILIKE 'Subaru' AND model ILIKE 'Legacy B4')
  OR (make ILIKE 'Subaru' AND model ILIKE 'Impreza-G4')
  OR (make ILIKE 'Subaru' AND model ILIKE 'Impreza G4')
  OR (make ILIKE 'Subaru' AND model ILIKE 'Legacy-Outback')
  -- Toyota non-US
  OR (make ILIKE 'Toyota' AND model ILIKE 'Majesty')
  OR (make ILIKE 'Toyota' AND model ILIKE 'Venturer')
  -- Ford non-US
  OR (make ILIKE 'Ford' AND model ILIKE 'Fiesta-Active')
  OR (make ILIKE 'Ford' AND model ILIKE 'Fiesta Active')
  -- Hyundai naming
  OR (make ILIKE 'Hyundai' AND model ILIKE 'Elantra-GT' AND year < 2018)
  -- Mercedes non-US
  OR (make ILIKE 'Mercedes' AND model ILIKE 'Marco-Polo')
  OR (make ILIKE 'Mercedes' AND model ILIKE 'Marco Polo')
  -- Chrysler duplicates (Voyager = Pacifica in US after 2017)
  OR (make ILIKE 'Chrysler' AND model ILIKE 'Grand-Voyager')
  OR (make ILIKE 'Chrysler' AND model ILIKE 'Grand Voyager');

SELECT 'AFTER' as status, COUNT(*) as total FROM vehicle_fitments;

COMMIT;
