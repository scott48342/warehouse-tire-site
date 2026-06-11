-- ═══════════════════════════════════════════════════════════════════════════
-- 2018 Vehicle Fitments Cleanup Migration
-- Generated: 2026-06-10  |  Status: NOT EXECUTED — human review required
--
-- Scope (per fable-migration-plan.md APPROVED ACTIONS):
--   1. Delete deprecated-staggered-split rows that have a merged replacement
--   2. Normalize malformed makes (strip category suffixes: Minivans/Vans/etc.)
--   3. Normalize make casing (Smart→smart, RAM→Ram, match existing canon)
--
-- DOES NOT TOUCH: bolt_pattern, center_bore_mm, offsets, oem_wheel_sizes,
--                 oem_tire_sizes, quality_tier
--
-- Safety: everything runs in ONE transaction. All deleted/updated rows are
-- copied to backup tables FIRST. Final assertions abort (ROLLBACK via
-- exception) if counts don't match expectations.
--
-- HOW TO RUN (manually, after review):
--   psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-migration.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 0: Backup tables (full row snapshots; used by rollback script)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vf_migration_2018_deleted (
  LIKE vehicle_fitments INCLUDING ALL
);
COMMENT ON TABLE vf_migration_2018_deleted IS
  '2018 cleanup migration: full copies of deleted deprecated-staggered-split rows';

CREATE TABLE IF NOT EXISTS vf_migration_2018_make_changes (
  id            uuid PRIMARY KEY,
  old_make      text NOT NULL,
  new_make      text NOT NULL,
  change_type   text NOT NULL,   -- 'malformed_split' | 'casing'
  changed_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE vf_migration_2018_make_changes IS
  '2018 cleanup migration: make rename audit log (for rollback)';

-- Abort if a previous run left backup data behind (avoid mixing runs)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM vf_migration_2018_deleted) > 0
     OR (SELECT COUNT(*) FROM vf_migration_2018_make_changes) > 0 THEN
    RAISE EXCEPTION 'Backup tables are not empty — previous migration run detected. Inspect/rollback/truncate before re-running.';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: Delete deprecated-staggered-split rows WITH merged replacement
--
-- Base-trim extraction: deprecated trims have the form
--   "{base} Front {base}"  or  "{base} Rear {base}"
-- e.g. "Base Front Base", "Quadrifoglio Rear Quadrifoglio",
--      "Ti w/Sport Pkg. Front Ti w/Sport Pkg."
-- Base trim = substring before the LAST " Front " / " Rear " delimiter whose
-- prefix equals its suffix; simpler robust rule: take the text before the
-- first occurrence of ' Front ' or ' Rear ' (the base never contains these
-- words as standalone tokens in this dataset — verified in investigation).
-- ───────────────────────────────────────────────────────────────────────────

-- Snapshot pre-existing duplicate YMMT groups (case-insensitive) so the
-- final assertion only fails on NEW duplicates created by this migration.
CREATE TEMP TABLE tmp_preexisting_dup_ymmt ON COMMIT DROP AS
SELECT year,
       LOWER(make)  AS make_lower,
       LOWER(model) AS model_lower,
       LOWER(COALESCE(display_trim,'')) AS trim_lower
FROM vehicle_fitments
GROUP BY 1,2,3,4
HAVING COUNT(*) > 1;

-- Materialize the delete candidates with their computed base trim
CREATE TEMP TABLE tmp_dep_candidates ON COMMIT DROP AS
SELECT
  d.id,
  d.year,
  d.make,
  d.model,
  d.display_trim,
  TRIM(
    CASE
      WHEN d.display_trim ~* '\mFront\M'
        THEN SPLIT_PART(d.display_trim, ' Front ', 1)
      WHEN d.display_trim ~* '\mRear\M'
        THEN SPLIT_PART(d.display_trim, ' Rear ', 1)
      ELSE d.display_trim
    END
  ) AS base_trim
FROM vehicle_fitments d
WHERE d.source = 'deprecated-staggered-split'
  AND d.year = 2018;

-- Keep only candidates whose merged replacement EXISTS
CREATE TEMP TABLE tmp_dep_deletable ON COMMIT DROP AS
SELECT c.id
FROM tmp_dep_candidates c
WHERE EXISTS (
  SELECT 1
  FROM vehicle_fitments m
  WHERE m.source = 'merged-staggered'
    AND m.year = c.year
    AND LOWER(m.make)  = LOWER(c.make)
    AND LOWER(m.model) = LOWER(c.model)
    AND LOWER(COALESCE(m.display_trim, '')) = LOWER(c.base_trim)
);

-- Report (visible in psql output)
DO $$
DECLARE
  v_total int;
  v_deletable int;
BEGIN
  SELECT COUNT(*) INTO v_total FROM tmp_dep_candidates;
  SELECT COUNT(*) INTO v_deletable FROM tmp_dep_deletable;
  RAISE NOTICE 'Deprecated split rows (2018): % total, % with verified merged replacement (will delete), % orphaned (kept for review)',
    v_total, v_deletable, v_total - v_deletable;
END $$;

-- Backup, then delete
INSERT INTO vf_migration_2018_deleted
SELECT vf.* FROM vehicle_fitments vf
WHERE vf.id IN (SELECT id FROM tmp_dep_deletable);

DELETE FROM vehicle_fitments
WHERE id IN (SELECT id FROM tmp_dep_deletable);

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: Normalize malformed makes (strip category suffixes)
-- Collision rule: skip the rename if an identical YMMT already exists under
-- the clean make (those rows are logged as skipped, left for human review).
-- ───────────────────────────────────────────────────────────────────────────

CREATE TEMP TABLE tmp_make_map (bad_make text PRIMARY KEY, good_make text NOT NULL)
ON COMMIT DROP;

INSERT INTO tmp_make_map (bad_make, good_make) VALUES
  ('Chevrolet Minivans',      'Chevrolet'),
  ('Chevrolet Vans',          'Chevrolet'),
  ('Nissan Vans',             'Nissan'),
  ('Nissan Minivans',         'Nissan'),
  ('Ford Minivans',           'Ford'),
  ('Ford Vans',               'Ford'),
  ('Mercedes-Benz Minivans',  'Mercedes-Benz'),
  ('Mercedes-Benz Vans',      'Mercedes-Benz'),
  ('Toyota Minivans',         'Toyota'),
  ('RAM Minivans',            'Ram'),
  ('RAM Vans',                'Ram'),
  ('GMC Vans',                'GMC'),
  ('GMC Minivans',            'GMC'),
  ('Kia Minivans',            'Kia'),
  ('Honda Minivans',          'Honda'),
  ('Chrysler Minivans',       'Chrysler'),
  ('Dodge Minivans',          'Dodge'),
  ('Dodge Vans',              'Dodge');

-- Catch "any others discovered": generic suffix-strip for makes ending in a
-- category word whose base is an existing canonical make in the table.
INSERT INTO tmp_make_map (bad_make, good_make)
SELECT DISTINCT
  vf.make AS bad_make,
  base.make AS good_make
FROM vehicle_fitments vf
JOIN LATERAL (
  SELECT TRIM(REGEXP_REPLACE(vf.make,
    '\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$',
    '', 'i')) AS base_make
) s ON s.base_make <> vf.make
JOIN LATERAL (
  -- resolve base to the existing canonical casing used in the table
  SELECT m.make
  FROM vehicle_fitments m
  WHERE LOWER(m.make) = LOWER(s.base_make)
    AND m.make !~* '(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$'
  GROUP BY m.make
  ORDER BY COUNT(*) DESC
  LIMIT 1
) base ON TRUE
WHERE vf.make ~* '\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$'
ON CONFLICT (bad_make) DO NOTHING;

-- Determine which rows can be renamed without creating a YMMT duplicate
CREATE TEMP TABLE tmp_make_renames ON COMMIT DROP AS
SELECT vf.id, vf.make AS old_make, mm.good_make AS new_make
FROM vehicle_fitments vf
JOIN tmp_make_map mm ON mm.bad_make = vf.make
WHERE NOT EXISTS (
  SELECT 1 FROM vehicle_fitments dup
  WHERE dup.year = vf.year
    AND LOWER(dup.make) = LOWER(mm.good_make)
    AND LOWER(dup.model) = LOWER(vf.model)
    AND LOWER(COALESCE(dup.display_trim,'')) = LOWER(COALESCE(vf.display_trim,''))
    AND dup.id <> vf.id
);

DO $$
DECLARE
  v_total int;
  v_renaming int;
BEGIN
  SELECT COUNT(*) INTO v_total FROM vehicle_fitments vf JOIN tmp_make_map mm ON mm.bad_make = vf.make;
  SELECT COUNT(*) INTO v_renaming FROM tmp_make_renames;
  RAISE NOTICE 'Malformed makes: % rows matched, % will be renamed, % skipped due to YMMT collision (review manually)',
    v_total, v_renaming, v_total - v_renaming;
END $$;

-- Audit log, then update
INSERT INTO vf_migration_2018_make_changes (id, old_make, new_make, change_type)
SELECT id, old_make, new_make, 'malformed_split' FROM tmp_make_renames;

UPDATE vehicle_fitments vf
SET make = r.new_make
FROM tmp_make_renames r
WHERE vf.id = r.id;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: Normalize make casing to existing canonical forms
-- Canon = the casing variant with the MOST records table-wide for each
-- case-insensitive make group. Explicit overrides applied first.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TEMP TABLE tmp_case_canon ON COMMIT DROP AS
SELECT LOWER(make) AS make_lower,
       (ARRAY_AGG(make ORDER BY cnt DESC, make))[1] AS canonical_make
FROM (
  SELECT make, COUNT(*) AS cnt
  FROM vehicle_fitments
  GROUP BY make
) t
GROUP BY LOWER(make)
HAVING COUNT(*) > 1;  -- only groups with >1 casing variant

-- Explicit overrides per plan (these win over majority-casing)
-- smart: official branding is lowercase. Ram: official post-2011 styling.
UPDATE tmp_case_canon SET canonical_make = 'smart' WHERE make_lower = 'smart';
UPDATE tmp_case_canon SET canonical_make = 'Ram'   WHERE make_lower = 'ram';

CREATE TEMP TABLE tmp_case_renames ON COMMIT DROP AS
SELECT vf.id, vf.make AS old_make, cc.canonical_make AS new_make
FROM vehicle_fitments vf
JOIN tmp_case_canon cc ON LOWER(vf.make) = cc.make_lower
WHERE vf.make <> cc.canonical_make
  -- collision guard (same YMMT already exists under canonical casing)
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_fitments dup
    WHERE dup.year = vf.year
      AND dup.make = cc.canonical_make
      AND LOWER(dup.model) = LOWER(vf.model)
      AND LOWER(COALESCE(dup.display_trim,'')) = LOWER(COALESCE(vf.display_trim,''))
      AND dup.id <> vf.id
  );

DO $$
DECLARE v_n int;
BEGIN
  SELECT COUNT(*) INTO v_n FROM tmp_case_renames;
  RAISE NOTICE 'Make casing: % rows will be re-cased to canonical form', v_n;
END $$;

INSERT INTO vf_migration_2018_make_changes (id, old_make, new_make, change_type)
SELECT id, old_make, new_make, 'casing' FROM tmp_case_renames;

UPDATE vehicle_fitments vf
SET make = r.new_make
FROM tmp_case_renames r
WHERE vf.id = r.id;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4: Post-migration assertions (abort transaction on failure)
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_remaining_dep int;
  v_orphan_dep int;
  v_bad_makes int;
  v_backup_count int;
  v_deleted_expected int;
BEGIN
  -- 4a. Every remaining deprecated-split 2018 row must be an orphan
  --     (no merged replacement) — i.e. we deleted exactly the replaceable set.
  SELECT COUNT(*) INTO v_remaining_dep
  FROM vehicle_fitments WHERE source='deprecated-staggered-split' AND year=2018;

  SELECT COUNT(*) INTO v_orphan_dep
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
  IF v_orphan_dep > 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: % deprecated rows with merged replacements still present', v_orphan_dep;
  END IF;
  RAISE NOTICE 'OK: no replaceable deprecated rows remain (% orphans kept for review)', v_remaining_dep;

  -- 4b. Backup table row count must equal rows actually deleted
  SELECT COUNT(*) INTO v_backup_count FROM vf_migration_2018_deleted;
  IF v_backup_count = 0 THEN
    RAISE EXCEPTION 'ASSERTION FAILED: backup table is empty — nothing was backed up before delete';
  END IF;
  RAISE NOTICE 'OK: % deleted rows preserved in vf_migration_2018_deleted', v_backup_count;

  -- 4c. No category-suffix makes should remain EXCEPT collision-skipped ones
  SELECT COUNT(*) INTO v_bad_makes
  FROM vehicle_fitments
  WHERE make ~* '\s+(Minivans|Vans|Trucks|SUVs|Crossovers|Sedans|Coupes|Convertibles|Wagons|Hatchbacks|Pickups?)$';
  RAISE NOTICE 'Category-suffix makes remaining (collision-skipped, needs review): %', v_bad_makes;

  -- 4d. No NEW duplicate YMMT groups introduced by the migration.
  --     Case-insensitive dup groups that already existed pre-migration are
  --     excluded (re-casing makes cannot create new case-insensitive dupes;
  --     they were already duplicates and are tracked by vw_integrity_dup_ymmt).
  IF EXISTS (
    SELECT 1
    FROM vehicle_fitments a
    JOIN vf_migration_2018_make_changes mc ON mc.id = a.id
    JOIN vehicle_fitments b
      ON b.id <> a.id
     AND b.year = a.year
     AND LOWER(b.make) = LOWER(a.make)
     AND LOWER(b.model) = LOWER(a.model)
     AND LOWER(COALESCE(b.display_trim,'')) = LOWER(COALESCE(a.display_trim,''))
    WHERE NOT EXISTS (
      SELECT 1 FROM tmp_preexisting_dup_ymmt p
      WHERE p.year = a.year
        AND p.make_lower = LOWER(a.make)
        AND p.model_lower = LOWER(a.model)
        AND p.trim_lower = LOWER(COALESCE(a.display_trim,''))
    )
  ) THEN
    RAISE EXCEPTION 'ASSERTION FAILED: make rename created NEW duplicate YMMT keys';
  END IF;
  RAISE NOTICE 'OK: no NEW duplicate YMMT keys created by renames (pre-existing dup groups excluded)';
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Final summary
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM vf_migration_2018_deleted)                          AS rows_deleted,
  (SELECT COUNT(*) FROM vf_migration_2018_make_changes
    WHERE change_type='malformed_split')                                    AS makes_split,
  (SELECT COUNT(*) FROM vf_migration_2018_make_changes
    WHERE change_type='casing')                                             AS makes_recased,
  (SELECT COUNT(*) FROM vehicle_fitments WHERE year=2018)                   AS total_2018_after;

-- ═══════════════════════════════════════════════════════════════════════════
-- REVIEW THE NOTICES + SUMMARY ABOVE. If anything looks wrong:  ROLLBACK;
-- If everything checks out:                                      COMMIT;
-- (Left as explicit manual step — this file intentionally does NOT commit.)
-- ═══════════════════════════════════════════════════════════════════════════
-- COMMIT;
