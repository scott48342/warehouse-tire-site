-- ═══════════════════════════════════════════════════════════════════════════
-- 2018 Vehicle Fitments Cleanup — ROLLBACK
-- Generated: 2026-06-10  |  Run ONLY after the migration was COMMITted.
-- (If the migration transaction was never committed, just ROLLBACK; — this
--  file is for reversing a committed run.)
--
-- Restores:
--   1. Deleted deprecated-staggered-split rows (from vf_migration_2018_deleted)
--   2. Original make values (from vf_migration_2018_make_changes)
--
-- HOW TO RUN:
--   psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Preconditions: backup tables must exist and contain data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_name = 'vf_migration_2018_deleted') THEN
    RAISE EXCEPTION 'Backup table vf_migration_2018_deleted does not exist — nothing to roll back.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_name = 'vf_migration_2018_make_changes') THEN
    RAISE EXCEPTION 'Backup table vf_migration_2018_make_changes does not exist — nothing to roll back.';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: Revert make renames (reverse order: casing first, then splits —
-- order doesn't actually matter since old_make is stored per row, but we
-- guard against rows whose make was changed again after the migration).
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_expected int;
  v_reverted int;
  v_drifted  int;
BEGIN
  SELECT COUNT(*) INTO v_expected FROM vf_migration_2018_make_changes;

  -- Rows whose current make no longer matches what the migration set
  -- (i.e. they were modified after the migration) — report, do not revert.
  SELECT COUNT(*) INTO v_drifted
  FROM vf_migration_2018_make_changes mc
  JOIN vehicle_fitments vf ON vf.id = mc.id
  WHERE vf.make <> mc.new_make;

  IF v_drifted > 0 THEN
    RAISE WARNING '% rows were modified after migration (current make <> migrated make); these will NOT be reverted automatically. Inspect manually.', v_drifted;
  END IF;

  UPDATE vehicle_fitments vf
  SET make = mc.old_make
  FROM vf_migration_2018_make_changes mc
  WHERE vf.id = mc.id
    AND vf.make = mc.new_make;   -- only revert untouched rows

  GET DIAGNOSTICS v_reverted = ROW_COUNT;
  RAISE NOTICE 'Make renames reverted: % of % (drifted/skipped: %)', v_reverted, v_expected, v_expected - v_reverted;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: Restore deleted deprecated-staggered-split rows
-- Skip any id that already exists (partial rollback / re-run safety).
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_backup int;
  v_restored int;
BEGIN
  SELECT COUNT(*) INTO v_backup FROM vf_migration_2018_deleted;

  INSERT INTO vehicle_fitments
  SELECT b.*
  FROM vf_migration_2018_deleted b
  WHERE NOT EXISTS (SELECT 1 FROM vehicle_fitments vf WHERE vf.id = b.id);

  GET DIAGNOSTICS v_restored = ROW_COUNT;
  RAISE NOTICE 'Deleted rows restored: % of % (already present: %)', v_restored, v_backup, v_backup - v_restored;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: Verify restoration
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_missing int;
BEGIN
  SELECT COUNT(*) INTO v_missing
  FROM vf_migration_2018_deleted b
  WHERE NOT EXISTS (SELECT 1 FROM vehicle_fitments vf WHERE vf.id = b.id);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'ROLLBACK INCOMPLETE: % backed-up rows still missing from vehicle_fitments', v_missing;
  END IF;
  RAISE NOTICE 'OK: all backed-up rows present in vehicle_fitments';
END $$;

SELECT
  (SELECT COUNT(*) FROM vehicle_fitments WHERE year=2018)                              AS total_2018_after_rollback,
  (SELECT COUNT(*) FROM vehicle_fitments WHERE year=2018 AND source='deprecated-staggered-split') AS deprecated_rows_restored;

-- ═══════════════════════════════════════════════════════════════════════════
-- After verifying the summary above:
--   COMMIT;
-- Then optionally clean up backup tables (keep them until fully confident):
--   DROP TABLE vf_migration_2018_deleted;
--   DROP TABLE vf_migration_2018_make_changes;
-- ═══════════════════════════════════════════════════════════════════════════
-- COMMIT;
