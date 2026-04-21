-- ============================================================
-- PHASE 2: FIX WRONG TIRE SIZES
-- Correct tire sizes based on OEM validation
-- ============================================================

BEGIN;

-- ============================================================
-- TOYOTA TIRE SIZE CORRECTIONS
-- ============================================================

-- Corolla Cross 2022-2026: Fix completely wrong sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["215/65R17", "225/55R18"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Corolla Cross' 
  AND year BETWEEN 2022 AND 2026;

-- Corolla 2000-2002: Fix wheel diameter (was showing 15-18", should be 14")
UPDATE vehicle_fitments
SET oem_tire_sizes = '["175/65R14", "185/65R14"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Corolla' 
  AND year BETWEEN 2000 AND 2002;

-- GR Corolla 2023-2026: Fix completely wrong sizes (was regular Corolla sizes)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/40R18", "245/40R18"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND (model ILIKE 'GR Corolla' OR model ILIKE 'GR-Corolla')
  AND year BETWEEN 2023 AND 2026;

-- 4Runner 2025-2026: Fix sizes for new generation
UPDATE vehicle_fitments
SET oem_tire_sizes = '["245/70R17", "265/70R18", "265/60R20", "265/55R20"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE '4Runner' 
  AND year BETWEEN 2025 AND 2026;

-- FJ Cruiser 2007-2014: Fix tire width (245 -> 265)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["265/75R16", "265/70R17"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'FJ Cruiser' 
  AND year BETWEEN 2007 AND 2014;

-- Grand Highlander 2024-2025: Fix tire width
UPDATE vehicle_fitments
SET oem_tire_sizes = '["255/65R18", "255/55R20", "255/50R21"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Grand Highlander' 
  AND year BETWEEN 2024 AND 2026;

-- Sequoia 2023-2026: Fix tire width (275 -> 265)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["265/60R20", "265/50R22", "285/65R18"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Sequoia' 
  AND year BETWEEN 2023 AND 2026;

-- Tundra 2022-2026: Fix tire width
UPDATE vehicle_fitments
SET oem_tire_sizes = '["265/60R20", "265/70R18", "275/55R20", "285/65R18"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Tundra' 
  AND year BETWEEN 2022 AND 2026;

-- Sienna Gen 4 (2021-2026): Remove non-existent 19" option
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/65R17", "235/60R18", "235/50R20"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Sienna' 
  AND year BETWEEN 2021 AND 2026;

-- Camry 2012-2014: Fix tire width (235 -> 225)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/65R16", "215/55R17", "225/45R18"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Camry' 
  AND year BETWEEN 2012 AND 2014;

-- Avalon 2005-2012: Fix tire width (205 -> 215)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["215/60R16", "215/55R17"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Avalon' 
  AND year BETWEEN 2005 AND 2012;

-- Venza 2021-2025: Fix sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["225/60R18", "225/55R19"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Venza' 
  AND year BETWEEN 2021 AND 2026;

-- Land Cruiser 2024-2026: Populate new gen sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["245/70R18", "265/70R18", "265/60R20"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Land Cruiser' 
  AND year BETWEEN 2024 AND 2026;

-- ============================================================
-- LEXUS TIRE SIZE CORRECTIONS
-- ============================================================

-- LX 2022-2026: Fix width (275 -> 265)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["265/65R18", "265/55R20", "265/50R22"]'::jsonb
WHERE make ILIKE 'Lexus' 
  AND model ILIKE 'LX%' 
  AND year BETWEEN 2022 AND 2026;

-- LX 2000-2007 (LX 470): Fix wheel diameter
UPDATE vehicle_fitments
SET oem_tire_sizes = '["275/70R16"]'::jsonb
WHERE make ILIKE 'Lexus' 
  AND model ILIKE 'LX%' 
  AND year BETWEEN 2000 AND 2007;

-- RC 2015-2025: Fix completely wrong sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/45R18", "235/40R19", "255/35R19", "265/35R19"]'::jsonb
WHERE make ILIKE 'Lexus' 
  AND model ILIKE 'RC%' 
  AND year BETWEEN 2015 AND 2025;

-- ============================================================
-- VOLKSWAGEN TIRE SIZE CORRECTIONS
-- ============================================================

-- Arteon 2020-2025: Fix width (255 -> 245)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["245/45R18", "245/40R19", "245/35R20"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'Arteon' 
  AND year BETWEEN 2020 AND 2025;

-- GTI 2022-2026: Fix width (225 -> 235)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["225/45R17", "225/40R18", "235/35R19"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'GTI' 
  AND year BETWEEN 2022 AND 2026;

-- Jetta 2019-2026: Fix aspect ratios
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/65R16", "205/60R16", "205/55R17", "225/45R18"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'Jetta' 
  AND model NOT ILIKE '%GLI%'
  AND year BETWEEN 2019 AND 2026;

-- Passat 2000-2005: Fix width (235 -> 225)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15", "205/55R16", "225/45R17"]'::jsonb
WHERE make ILIKE 'Volkswagen' 
  AND model ILIKE 'Passat' 
  AND year BETWEEN 2000 AND 2005;

-- ============================================================
-- VOLVO TIRE SIZE CORRECTIONS
-- ============================================================

-- S60 2019-2025: Fix sizes (had old gen)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/45R18", "235/40R19", "245/40R19", "255/35R20"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'S60' 
  AND year BETWEEN 2019 AND 2026;

-- S60 2001-2009 (Gen 1): Fix - remove R19/R20 sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/55R16", "215/55R16", "225/45R17", "235/40R18"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'S60' 
  AND year BETWEEN 2001 AND 2009;

-- XC90 2003-2014 (Gen 1): Fix - use correct Gen 1 sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["225/70R16", "235/65R17", "235/60R18", "255/50R19", "255/45R20"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'XC90' 
  AND year BETWEEN 2003 AND 2014;

-- S90 2017-2025: Fix width (245 -> 255)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["245/45R18", "255/40R19", "255/35R20"]'::jsonb
WHERE make ILIKE 'Volvo' 
  AND model ILIKE 'S90' 
  AND year BETWEEN 2017 AND 2026;

-- ============================================================
-- SUZUKI TIRE SIZE CORRECTIONS
-- ============================================================

-- Grand Vitara 2000-2005: Fix size
UPDATE vehicle_fitments
SET oem_tire_sizes = '["235/60R16", "225/70R16"]'::jsonb
WHERE make ILIKE 'Suzuki' 
  AND model ILIKE 'Grand Vitara' 
  AND year BETWEEN 2000 AND 2005;

-- Kizashi 2010-2013: Fix width
UPDATE vehicle_fitments
SET oem_tire_sizes = '["215/60R16", "215/55R17", "235/45R18"]'::jsonb
WHERE make ILIKE 'Suzuki' 
  AND model ILIKE 'Kizashi' 
  AND year BETWEEN 2010 AND 2013;

-- SX4 2007-2013: Fix size
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15", "205/60R16", "205/50R17"]'::jsonb
WHERE make ILIKE 'Suzuki' 
  AND model ILIKE 'SX4' 
  AND year BETWEEN 2007 AND 2013;

-- ============================================================
-- KIA TIRE SIZE CORRECTIONS
-- ============================================================

-- Forte GT 2019-2026: Fix width (235 -> 225)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/55R16", "215/45R17", "225/40R18"]'::jsonb
WHERE make ILIKE 'Kia' 
  AND model ILIKE 'Forte%' 
  AND year BETWEEN 2019 AND 2026;

-- EV9 2024-2026: Add missing sizes
UPDATE vehicle_fitments
SET oem_tire_sizes = '["255/60R19", "275/50R20", "285/45R21"]'::jsonb
WHERE make ILIKE 'Kia' 
  AND model ILIKE 'EV9' 
  AND year BETWEEN 2024 AND 2026;

-- ============================================================
-- PRIUS CORRECTIONS (Generation-specific)
-- ============================================================

-- Prius Gen 1 (2000-2003): 14" wheels only
UPDATE vehicle_fitments
SET oem_tire_sizes = '["175/65R14"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Prius' 
  AND model NOT ILIKE '%V%' 
  AND model NOT ILIKE '%Prime%' 
  AND model NOT ILIKE '%Plug%'
  AND year BETWEEN 2000 AND 2003;

-- Prius Gen 2 (2004-2009)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["185/65R15", "195/55R16"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Prius' 
  AND model NOT ILIKE '%V%' 
  AND model NOT ILIKE '%Prime%' 
  AND model NOT ILIKE '%Plug%'
  AND year BETWEEN 2004 AND 2009;

-- Prius Gen 3 (2010-2015)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15", "215/45R17"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Prius' 
  AND model NOT ILIKE '%V%' 
  AND model NOT ILIKE '%Prime%' 
  AND model NOT ILIKE '%Plug%'
  AND year BETWEEN 2010 AND 2015;

-- Prius Gen 4 (2016-2022)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15", "215/45R17"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Prius' 
  AND model NOT ILIKE '%V%' 
  AND model NOT ILIKE '%Prime%' 
  AND model NOT ILIKE '%Plug%'
  AND year BETWEEN 2016 AND 2022;

-- Prius Gen 5 (2023+)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/60R17", "195/50R19"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Prius' 
  AND model NOT ILIKE '%V%' 
  AND model NOT ILIKE '%Prime%' 
  AND model NOT ILIKE '%Plug%'
  AND year BETWEEN 2023 AND 2026;

-- Prius V (2012-2017)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["205/60R16", "215/50R17"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Prius V' 
  AND year BETWEEN 2012 AND 2017;

-- Prius Prime (2017-2022)
UPDATE vehicle_fitments
SET oem_tire_sizes = '["195/65R15"]'::jsonb
WHERE make ILIKE 'Toyota' 
  AND model ILIKE 'Prius Prime' 
  AND year BETWEEN 2017 AND 2022;

SELECT 'Tire sizes updated' as status;

COMMIT;
