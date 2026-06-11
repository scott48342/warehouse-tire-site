-- ═══════════════════════════════════════════════════════════════════════════
-- Vehicle Fitments — Standing Integrity Check Views
-- Generated: 2026-06-10 | Safe to run any time (CREATE OR REPLACE VIEW only)
--
-- Each view returns VIOLATIONS — a healthy database returns 0 rows from all.
-- Wire into pre-deploy:  SELECT COUNT(*) FROM each view, fail if > 0
-- (vw_integrity_year_spikes is advisory: investigate, don't hard-fail.)
--
--   psql "$POSTGRES_URL" -f scripts/migrations/2018-integrity-checks.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Case-variant duplicate makes ("ford" vs "Ford")
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_integrity_case_dup_makes AS
SELECT LOWER(make)              AS make_lower,
       ARRAY_AGG(DISTINCT make) AS casing_variants,
       SUM(cnt)::int            AS total_rows
FROM (SELECT make, COUNT(*) AS cnt FROM vehicle_fitments GROUP BY make) t
GROUP BY LOWER(make)
HAVING COUNT(DISTINCT make) > 1;
COMMENT ON VIEW vw_integrity_case_dup_makes IS
  'Makes that exist with multiple casings. Healthy = 0 rows.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Phantom/category makes ("Chevrolet Minivans", "Nissan Vans", ...)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_integrity_category_makes AS
SELECT make, COUNT(*)::int AS n
FROM vehicle_fitments
WHERE make ~* '\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$'
GROUP BY make;
COMMENT ON VIEW vw_integrity_category_makes IS
  'Makes containing vehicle-category suffixes (taxonomy leak). Healthy = 0 rows.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Duplicate YMMT keys (same year/make/model/display_trim, case-insensitive)
--    Note: staggered Front/Rear rows were a legitimate historical exception;
--    after the 2018 cleanup they should not exist.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_integrity_dup_ymmt AS
SELECT year,
       LOWER(make)  AS make_lower,
       LOWER(model) AS model_lower,
       LOWER(COALESCE(display_trim,'')) AS trim_lower,
       COUNT(*)::int          AS copies,
       ARRAY_AGG(id)          AS ids,
       ARRAY_AGG(DISTINCT source) AS sources
FROM vehicle_fitments
GROUP BY 1,2,3,4
HAVING COUNT(*) > 1;
COMMENT ON VIEW vw_integrity_dup_ymmt IS
  'Duplicate year+make+model+trim keys. Healthy = 0 rows (review sources column for import origin).';

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Missing required wheel-fitment fields (search-visible safety issue)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_integrity_missing_wheel_fields AS
SELECT id, year, make, model, display_trim, source,
       (bolt_pattern IS NULL)                                            AS missing_bolt_pattern,
       (center_bore_mm IS NULL)                                          AS missing_center_bore,
       (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]','null','')) AS missing_wheel_sizes,
       (oem_tire_sizes  IS NULL OR oem_tire_sizes::text  IN ('[]','null','','{}')) AS missing_tire_sizes
FROM vehicle_fitments
WHERE bolt_pattern IS NULL
   OR center_bore_mm IS NULL
   OR oem_wheel_sizes IS NULL OR oem_wheel_sizes::text IN ('[]','null','')
   OR oem_tire_sizes  IS NULL OR oem_tire_sizes::text  IN ('[]','null','','{}');
COMMENT ON VIEW vw_integrity_missing_wheel_fields IS
  'Records missing safety-critical wheel fitment fields. Healthy = 0 rows. Source for the human review queue.';

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Abnormal year-count spikes (>2x the average of neighbor years)
--    Advisory — a spike means "investigate the import", not "auto-fail".
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_integrity_year_spikes AS
WITH yearly AS (
  SELECT year, COUNT(*)::numeric AS n
  FROM vehicle_fitments
  WHERE year >= 2000
  GROUP BY year
),
with_neighbors AS (
  SELECT y.year, y.n,
         (SELECT AVG(n2.n) FROM yearly n2
          WHERE n2.year BETWEEN y.year - 2 AND y.year + 2
            AND n2.year <> y.year) AS neighbor_avg
  FROM yearly y
)
SELECT year,
       n::int            AS records,
       ROUND(neighbor_avg)::int AS neighbor_avg,
       ROUND(n / NULLIF(neighbor_avg,0), 2) AS spike_ratio
FROM with_neighbors
WHERE neighbor_avg > 0 AND n > 2 * neighbor_avg;
COMMENT ON VIEW vw_integrity_year_spikes IS
  'Years with >2x the neighbor-average record count (possible duplicate/rogue import). Advisory.';

-- ───────────────────────────────────────────────────────────────────────────
-- Convenience: one-shot health summary
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_integrity_summary AS
SELECT 'case_dup_makes'        AS check_name, (SELECT COUNT(*) FROM vw_integrity_case_dup_makes)        AS violations UNION ALL
SELECT 'category_makes',                      (SELECT COUNT(*) FROM vw_integrity_category_makes)        UNION ALL
SELECT 'dup_ymmt',                            (SELECT COUNT(*) FROM vw_integrity_dup_ymmt)              UNION ALL
SELECT 'missing_wheel_fields',                (SELECT COUNT(*) FROM vw_integrity_missing_wheel_fields)  UNION ALL
SELECT 'year_spikes (advisory)',              (SELECT COUNT(*) FROM vw_integrity_year_spikes);
COMMENT ON VIEW vw_integrity_summary IS
  'One-row-per-check health summary. Healthy = all zeros (year_spikes advisory).';

SELECT * FROM vw_integrity_summary;
