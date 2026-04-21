-- ============================================================
-- PHASE 1A: DELETE PHANTOM YEARS
-- Vehicles listed for model years that don't exist in the US
-- ============================================================
-- Run with: psql $POSTGRES_URL -f 01-delete-phantom-years.sql
-- Or execute in Prisma Studio / database client
-- ============================================================

BEGIN;

-- Count before deletion
SELECT 'BEFORE DELETION - Phantom Year Counts:' as status;
SELECT make, model, year, COUNT(*) as records
FROM vehicle_fitments
WHERE 
  -- Toyota phantom years
  (make ILIKE 'Toyota' AND model ILIKE 'FJ Cruiser' AND year > 2014)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Land Cruiser' AND year BETWEEN 2021 AND 2023)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Prius Plug-in' AND year > 2015)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Prius V' AND year > 2017)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Yaris' AND year > 2020)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Venza' AND year IN (2016, 2017, 2018, 2019, 2020))
  OR (make ILIKE 'Toyota' AND model ILIKE 'Supra' AND year BETWEEN 2000 AND 2018)
  OR (make ILIKE 'Toyota' AND model ILIKE 'GR86' AND year < 2022)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Mirai' AND year < 2016)
  -- Volkswagen phantom years
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Beetle' AND year > 2019)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'ID.4' AND year < 2021)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Passat' AND year > 2022)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Taos' AND year < 2022)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Touareg' AND year > 2017)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Tiguan' AND year < 2009)
  -- Subaru phantom years
  OR (make ILIKE 'Subaru' AND model ILIKE 'WRX STI' AND year > 2021)
  OR (make ILIKE 'Subaru' AND model ILIKE 'WRX-STI' AND year > 2021)
  -- Volvo phantom years
  OR (make ILIKE 'Volvo' AND model ILIKE 'S60' AND year IN (2000, 2010))
  OR (make ILIKE 'Volvo' AND model ILIKE 'V60' AND year BETWEEN 2010 AND 2014)
  OR (make ILIKE 'Volvo' AND model ILIKE 'V90' AND year > 2021 AND model NOT ILIKE '%Cross Country%')
  OR (make ILIKE 'Volvo' AND model ILIKE 'XC40' AND year < 2019)
  OR (make ILIKE 'Volvo' AND model ILIKE 'XC60' AND year < 2010)
  OR (make ILIKE 'Volvo' AND model ILIKE 'XC90' AND year = 2015)
  -- Lexus phantom years
  OR (make ILIKE 'Lexus' AND model ILIKE 'NX' AND year < 2015)
  OR (make ILIKE 'Lexus' AND model ILIKE 'RC' AND year < 2015)
  -- Kia phantom years
  OR (make ILIKE 'Kia' AND model ILIKE 'EV6' AND year < 2022)
  OR (make ILIKE 'Kia' AND model ILIKE 'EV9' AND year < 2024)
  OR (make ILIKE 'Kia' AND model ILIKE 'Forte' AND year < 2010)
  OR (make ILIKE 'Kia' AND model ILIKE 'Niro' AND year < 2017)
GROUP BY make, model, year
ORDER BY make, model, year;

-- Perform deletion
DELETE FROM vehicle_fitments
WHERE 
  -- Toyota phantom years
  (make ILIKE 'Toyota' AND model ILIKE 'FJ Cruiser' AND year > 2014)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Land Cruiser' AND year BETWEEN 2021 AND 2023)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Prius Plug-in' AND year > 2015)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Prius V' AND year > 2017)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Yaris' AND year > 2020)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Venza' AND year IN (2016, 2017, 2018, 2019, 2020))
  OR (make ILIKE 'Toyota' AND model ILIKE 'Supra' AND year BETWEEN 2000 AND 2018)
  OR (make ILIKE 'Toyota' AND model ILIKE 'GR86' AND year < 2022)
  OR (make ILIKE 'Toyota' AND model ILIKE 'Mirai' AND year < 2016)
  -- Volkswagen phantom years
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Beetle' AND year > 2019)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'ID.4' AND year < 2021)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Passat' AND year > 2022)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Taos' AND year < 2022)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Touareg' AND year > 2017)
  OR (make ILIKE 'Volkswagen' AND model ILIKE 'Tiguan' AND year < 2009)
  -- Subaru phantom years
  OR (make ILIKE 'Subaru' AND model ILIKE 'WRX STI' AND year > 2021)
  OR (make ILIKE 'Subaru' AND model ILIKE 'WRX-STI' AND year > 2021)
  -- Volvo phantom years
  OR (make ILIKE 'Volvo' AND model ILIKE 'S60' AND year IN (2000, 2010))
  OR (make ILIKE 'Volvo' AND model ILIKE 'V60' AND year BETWEEN 2010 AND 2014)
  OR (make ILIKE 'Volvo' AND model ILIKE 'V90' AND year > 2021 AND model NOT ILIKE '%Cross Country%')
  OR (make ILIKE 'Volvo' AND model ILIKE 'XC40' AND year < 2019)
  OR (make ILIKE 'Volvo' AND model ILIKE 'XC60' AND year < 2010)
  OR (make ILIKE 'Volvo' AND model ILIKE 'XC90' AND year = 2015)
  -- Lexus phantom years
  OR (make ILIKE 'Lexus' AND model ILIKE 'NX' AND year < 2015)
  OR (make ILIKE 'Lexus' AND model ILIKE 'RC' AND year < 2015)
  -- Kia phantom years
  OR (make ILIKE 'Kia' AND model ILIKE 'EV6' AND year < 2022)
  OR (make ILIKE 'Kia' AND model ILIKE 'EV9' AND year < 2024)
  OR (make ILIKE 'Kia' AND model ILIKE 'Forte' AND year < 2010)
  OR (make ILIKE 'Kia' AND model ILIKE 'Niro' AND year < 2017);

SELECT 'Phantom years deleted' as status, COUNT(*) as remaining_records FROM vehicle_fitments;

COMMIT;
