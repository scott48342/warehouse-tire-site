-- ============================================================
-- PHASE 3: POPULATE EMPTY RECORDS
-- Fill in tire sizes for vehicles with empty arrays
-- ============================================================

BEGIN;

-- ============================================================
-- VOLKSWAGEN EMPTY RECORDS
-- ============================================================

-- Golf SportWagen 2010-2019
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15", "205/55R16", "225/45R17"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'Golf SportWagen'
  AND year BETWEEN 2010 AND 2019
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- Rabbit 2006-2009
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15", "205/55R16", "225/45R17"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'Rabbit'
  AND year BETWEEN 2006 AND 2009
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- Routan 2008-2014
UPDATE vehicle_fitments
SET oem_tire_sizes = '["225/65R16", "225/65R17"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'Routan'
  AND year BETWEEN 2008 AND 2014
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- Tiguan Limited 2017-2018
UPDATE vehicle_fitments
SET oem_tire_sizes = '["215/65R16", "235/55R17"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'Tiguan Limited'
  AND year BETWEEN 2017 AND 2018
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- ============================================================
-- VOLVO EMPTY RECORDS
-- ============================================================

-- V50 2005-2011
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/55R16", "205/50R17", "215/45R18"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'V50'
  AND year BETWEEN 2005 AND 2011
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- V90 Cross Country 2016-2025
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/50R19", "245/45R20", "245/40R21"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'V90 Cross Country'
  AND year BETWEEN 2016 AND 2026
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- S40 2004-2012
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15", "205/55R16", "205/50R17", "215/45R18"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'S40'
  AND year BETWEEN 2004 AND 2012
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- S70 2000
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/60R15", "195/65R15", "205/50R16", "205/55R16"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'S70'
  AND year = 2000
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- S80 2007-2016
UPDATE vehicle_fitments
SET oem_tire_sizes = '["225/50R17", "235/50R17", "245/40R18", "245/35R19"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'S80'
  AND year BETWEEN 2007 AND 2016
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- C40 2021-2025
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/50R19", "235/45R20", "255/40R20"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'C40'
  AND year BETWEEN 2021 AND 2026
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- XC40 Recharge staggered sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/50R19", "235/45R20", "255/40R20", "255/45R19"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'XC40%'
  AND year BETWEEN 2021 AND 2026
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- ============================================================
-- TOYOTA EMPTY RECORDS
-- ============================================================

-- Solara 1999-2008
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/65R15", "215/60R16", "215/55R17"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Solara'
  AND year BETWEEN 1999 AND 2008
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- C-HR 2018-2024
UPDATE vehicle_fitments
SET oem_tire_sizes = '["215/60R17", "225/50R18"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'C-HR'
  AND year BETWEEN 2018 AND 2024
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- 86 / GT-86 2012-2020
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/55R16", "215/45R17", "215/40R18"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND (model ILIKE '86' OR model ILIKE 'GT-86' OR model ILIKE 'GT86')
  AND year BETWEEN 2012 AND 2020
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- MR2 Spyder 2000-2005 (staggered)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["185/55R15", "205/50R15", "205/45R16", "215/45R16"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'MR2%'
  AND year BETWEEN 2000 AND 2005
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- ============================================================
-- SUBARU EMPTY RECORDS
-- ============================================================

-- WRX STI 2014-2021
UPDATE vehicle_fitments
SET oem_tire_sizes = '["245/40R18", "245/35R19"]'::jsonb
WHERE make ILIKE 'Subaru' 
  AND (model ILIKE 'WRX STI' OR model ILIKE 'WRX-STI')
  AND year BETWEEN 2014 AND 2021
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

-- ============================================================
-- KIA EMPTY RECORDS
-- ============================================================

-- K5 base sizes (if missing)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/65R16", "215/55R17", "235/45R18", "245/40R19"]'::jsonb
WHERE make ILIKE 'Kia' 
  AND model ILIKE 'K5'
  AND year BETWEEN 2021 AND 2026
  AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes::text = '[]');

SELECT 'Empty records populated' as status;

COMMIT;
