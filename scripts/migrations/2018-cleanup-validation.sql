-- ═══════════════════════════════════════════════════════════════════════════
-- 2018 Cleanup — Post-Migration Validation Queries (READ-ONLY)
-- Run AFTER committing the migration. Every check lists its PASS condition.
--   psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-validation.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK 1: No replaceable deprecated rows remain
-- PASS: n = 0  (any remaining deprecated rows must be orphans w/o merged twin)
-- ───────────────────────────────────────────────────────────────────────────
\echo 'CHECK 1: replaceable deprecated rows remaining (PASS = 0)'
SELECT COUNT(*) AS n
FROM vehicle_fitments d
WHERE d.source='deprecated-staggered-split' AND d.year=2018
  AND EXISTS (
    SELECT 1 FROM vehicle_fitments m
    WHERE m.source='merged-staggered' AND m.year=2018
      AND LOWER(m.make)=LOWER(d.make) AND LOWER(m.model)=LOWER(d.model)
      AND LOWER(COALESCE(m.display_trim,'')) =
          LOWER(TRIM(CASE
            WHEN d.display_trim ~* '\mFront\M' THEN SPLIT_PART(d.display_trim,' Front ',1)
            WHEN d.display_trim ~* '\mRear\M'  THEN SPLIT_PART(d.display_trim,' Rear ',1)
            ELSE d.display_trim END))
  );

-- List any orphaned deprecated rows kept (informational)
\echo 'CHECK 1b: orphaned deprecated rows kept for review (informational)'
SELECT id, make, model, display_trim
FROM vehicle_fitments
WHERE source='deprecated-staggered-split' AND year=2018
ORDER BY make, model LIMIT 50;

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK 2: All makes canonical — no category-suffix makes
-- PASS: n = 0 (or only known collision-skipped rows, listed below)
-- ───────────────────────────────────────────────────────────────────────────
\echo 'CHECK 2: category-suffix makes remaining (PASS = 0)'
SELECT make, COUNT(*) AS n
FROM vehicle_fitments
WHERE make ~* '\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$'
GROUP BY make ORDER BY n DESC;

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK 3: No case-variant duplicate makes
-- PASS: no rows returned
-- ───────────────────────────────────────────────────────────────────────────
\echo 'CHECK 3: case-variant make groups (PASS = no rows)'
SELECT LOWER(make) AS make_lower,
       ARRAY_AGG(DISTINCT make) AS variants,
       COUNT(*) AS total_rows
FROM vehicle_fitments
GROUP BY LOWER(make)
HAVING COUNT(DISTINCT make) > 1
ORDER BY total_rows DESC;

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK 4: No duplicate YMMT keys created by the migration
-- PASS: no rows returned (pre-existing dupes excluded by audit-table join)
-- ───────────────────────────────────────────────────────────────────────────
\echo 'CHECK 4: YMMT duplicates involving migrated rows (PASS = no rows)'
SELECT a.year, a.make, a.model, a.display_trim, COUNT(*) AS copies
FROM vehicle_fitments a
JOIN vf_migration_2018_make_changes mc ON mc.id = a.id
JOIN vehicle_fitments b
  ON b.id <> a.id
 AND b.year = a.year
 AND LOWER(b.make) = LOWER(a.make)
 AND LOWER(b.model) = LOWER(a.model)
 AND LOWER(COALESCE(b.display_trim,'')) = LOWER(COALESCE(a.display_trim,''))
GROUP BY a.year, a.make, a.model, a.display_trim;

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK 5: Backup integrity — deleted rows are all preserved
-- PASS: backup_rows = expected deletions; overlap = 0
-- ───────────────────────────────────────────────────────────────────────────
\echo 'CHECK 5: backup integrity'
SELECT
  (SELECT COUNT(*) FROM vf_migration_2018_deleted) AS backup_rows,
  (SELECT COUNT(*) FROM vf_migration_2018_deleted b
    WHERE EXISTS (SELECT 1 FROM vehicle_fitments vf WHERE vf.id=b.id)) AS still_in_table_should_be_0;

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK 6: Integrity views all pass (requires 2018-integrity-checks.sql)
-- PASS: every view returns 0 rows / no anomalies
-- ───────────────────────────────────────────────────────────────────────────
\echo 'CHECK 6: integrity views (PASS = 0 / no rows each)'
SELECT 'vw_integrity_case_dup_makes'   AS view, COUNT(*) AS violations FROM vw_integrity_case_dup_makes
UNION ALL
SELECT 'vw_integrity_category_makes',         COUNT(*) FROM vw_integrity_category_makes
UNION ALL
SELECT 'vw_integrity_dup_ymmt',               COUNT(*) FROM vw_integrity_dup_ymmt
UNION ALL
SELECT 'vw_integrity_missing_wheel_fields',   COUNT(*) FROM vw_integrity_missing_wheel_fields
UNION ALL
SELECT 'vw_integrity_year_spikes',            COUNT(*) FROM vw_integrity_year_spikes;

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK 7: Final 2018 record count vs expectation
-- PASS: total ≈ 1828 (2480 - 652) given investigation baseline
-- ───────────────────────────────────────────────────────────────────────────
\echo 'CHECK 7: 2018 totals (expected ~1828 after full deprecated deletion)'
SELECT year, COUNT(*) AS n
FROM vehicle_fitments
WHERE year BETWEEN 2016 AND 2020
GROUP BY year ORDER BY year;
