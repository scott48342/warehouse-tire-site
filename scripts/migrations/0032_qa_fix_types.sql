-- Fix QA Infrastructure Types
-- Change tire_diameter_expected from DECIMAL to TEXT to allow range strings

ALTER TABLE qa_results 
  ALTER COLUMN tire_diameter_expected TYPE TEXT;

-- Update canary vehicles with correct staggered expectations
-- Mustang GT base is NOT staggered, only GT Performance Pack+ are
UPDATE qa_canary_vehicles SET expected_staggered = FALSE 
WHERE make = 'Ford' AND model = 'Mustang' AND trim = 'GT';

-- Camaro SS is staggered, but base Camaro is not
UPDATE qa_canary_vehicles SET expected_staggered = FALSE 
WHERE make = 'Chevrolet' AND model = 'Camaro' AND trim NOT IN ('SS', 'ZL1', '1LE');

-- Challenger R/T base is not staggered, only Widebody/Hellcat are
UPDATE qa_canary_vehicles SET expected_staggered = FALSE 
WHERE make = 'Dodge' AND model = 'Challenger' AND trim = 'R/T';

-- Add missing staggered vehicles that ARE staggered
INSERT INTO qa_canary_vehicles (year, make, model, trim, category, expected_bolt_pattern, expected_staggered, is_performance, test_lifted, priority)
VALUES
(2024, 'Ford', 'Mustang', 'Dark Horse', 'staggered', '5x114.3', TRUE, TRUE, FALSE, 100),
(2024, 'Chevrolet', 'Camaro', '1LE', 'staggered', '5x120', TRUE, TRUE, FALSE, 100),
(2024, 'Dodge', 'Challenger', 'Widebody', 'staggered', '5x115', TRUE, TRUE, FALSE, 100)
ON CONFLICT (year, make, model, trim) DO UPDATE SET
  expected_staggered = EXCLUDED.expected_staggered,
  is_performance = EXCLUDED.is_performance,
  updated_at = NOW();
