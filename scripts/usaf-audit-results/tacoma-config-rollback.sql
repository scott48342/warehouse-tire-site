
-- ROLLBACK: 2024 Toyota Tacoma Config Enrichment
-- Run this to undo the enrichment

DELETE FROM vehicle_fitment_configurations
WHERE id IN ('0cce021a-d9b7-428a-9185-518aef2856e5', '6f3f67ce-b48a-4e69-a5ee-edfa5bd71457');

-- Verify deletion
SELECT COUNT(*) as remaining
FROM vehicle_fitment_configurations
WHERE year = 2024 AND make_key = 'toyota' AND model_key = 'tacoma'
  AND source = 'usaf_enrichment';
