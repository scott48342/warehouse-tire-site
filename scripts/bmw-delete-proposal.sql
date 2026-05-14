-- BMW M3/M4 FAKE "BASE" RECORDS - DELETE PROPOSAL
-- AUDIT DATE: 2026-05-13
-- 
-- These records have fake modification_ids and aggregate tire sizes
-- that bypass the resolver's fallback logic.
--
-- CRITERIA FOR DELETION:
-- 1. modification_id starts with 'manual_' OR equals 'base'
-- 2. display_trim is exactly 'Base' (not 'Base Front', 'Base, Competition', etc.)
-- 3. Years 2021-2026 (most customer-relevant, conservative scope)

-- DRY RUN: Count records to delete
SELECT COUNT(*) as records_to_delete
FROM vehicle_fitments 
WHERE make ILIKE 'BMW' 
  AND (model ILIKE 'M3' OR model ILIKE 'M4')
  AND display_trim = 'Base'
  AND (modification_id LIKE 'manual_%' OR modification_id = 'base')
  AND year >= 2021;

-- DRY RUN: Show exact records
SELECT 
  id,
  year,
  model,
  display_trim,
  modification_id,
  source
FROM vehicle_fitments 
WHERE make ILIKE 'BMW' 
  AND (model ILIKE 'M3' OR model ILIKE 'M4')
  AND display_trim = 'Base'
  AND (modification_id LIKE 'manual_%' OR modification_id = 'base')
  AND year >= 2021
ORDER BY year DESC, model;

-- ⚠️ DO NOT RUN UNTIL APPROVED:
-- DELETE FROM vehicle_fitments 
-- WHERE make ILIKE 'BMW' 
--   AND (model ILIKE 'M3' OR model ILIKE 'M4')
--   AND display_trim = 'Base'
--   AND (modification_id LIKE 'manual_%' OR modification_id = 'base')
--   AND year >= 2021;
