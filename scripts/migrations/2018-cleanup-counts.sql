-- ═══════════════════════════════════════════════════════════════════════════
-- 2018 Cleanup — Before/After Record Counts (READ-ONLY)
-- Run BEFORE the migration to capture the baseline, and AFTER to validate.
--   psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-counts.sql
-- ═══════════════════════════════════════════════════════════════════════════

\echo '── Snapshot ─────────────────────────────────────────────────────────'

-- 1. Total 2018 records
SELECT 'total_2018' AS metric, COUNT(*) AS n
FROM vehicle_fitments WHERE year = 2018;

-- 2. 2018 records by source
SELECT 'by_source: ' || COALESCE(NULLIF(source,''),'(null)') AS metric, COUNT(*) AS n
FROM vehicle_fitments WHERE year = 2018
GROUP BY source ORDER BY n DESC;

-- 3. Deprecated split rows + how many have merged replacements (delete-eligible)
WITH dep AS (
  SELECT d.id,
    TRIM(CASE
      WHEN d.display_trim ~* '\mFront\M' THEN SPLIT_PART(d.display_trim,' Front ',1)
      WHEN d.display_trim ~* '\mRear\M'  THEN SPLIT_PART(d.display_trim,' Rear ',1)
      ELSE d.display_trim END) AS base_trim,
    d.make, d.model, d.year
  FROM vehicle_fitments d
  WHERE d.source='deprecated-staggered-split' AND d.year=2018
)
SELECT 'deprecated_total' AS metric, COUNT(*) AS n FROM dep
UNION ALL
SELECT 'deprecated_with_merged_replacement (expected deletions)', COUNT(*)
FROM dep
WHERE EXISTS (
  SELECT 1 FROM vehicle_fitments m
  WHERE m.source='merged-staggered' AND m.year=dep.year
    AND LOWER(m.make)=LOWER(dep.make) AND LOWER(m.model)=LOWER(dep.model)
    AND LOWER(COALESCE(m.display_trim,''))=LOWER(dep.base_trim)
);

-- 4. Malformed-make rows (expected make-split updates, before collision skips)
SELECT 'malformed_make_rows (expected splits, pre-collision-check)' AS metric, COUNT(*) AS n
FROM vehicle_fitments
WHERE make ~* '\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$';

-- 5. Casing-variant rows (expected re-case updates, before collision skips)
WITH canon AS (
  SELECT LOWER(make) AS ml,
         (ARRAY_AGG(make ORDER BY cnt DESC, make))[1] AS canonical
  FROM (SELECT make, COUNT(*) cnt FROM vehicle_fitments GROUP BY make) t
  GROUP BY LOWER(make) HAVING COUNT(*) > 1
)
SELECT 'casing_variant_rows (expected re-casings)' AS metric, COUNT(*) AS n
FROM vehicle_fitments vf JOIN canon c ON LOWER(vf.make)=c.ml
WHERE vf.make <> c.canonical;

-- 6. Migration audit tables (post-migration only; errors harmlessly if absent)
\echo '── Post-migration audit (skip errors if not yet migrated) ──────────'
SELECT 'rows_deleted (backup table)' AS metric, COUNT(*) AS n FROM vf_migration_2018_deleted;
SELECT 'make_changes: ' || change_type AS metric, COUNT(*) AS n
FROM vf_migration_2018_make_changes GROUP BY change_type;

-- 7. Expected-vs-actual validation (run AFTER migration)
--    total_2018_after should equal total_2018_before - rows_deleted
\echo '── Expected math ───────────────────────────────────────────────────'
\echo 'EXPECTED: total_2018_after = total_2018_before - deprecated_with_merged_replacement'
\echo 'Investigation baseline (2026-06-10): 2480 total, 652 deprecated, 326 merged'
\echo 'Expected after: 2480 - 652 = 1828 (if all 652 have replacements)'
