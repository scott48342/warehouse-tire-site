# 2018 Vehicle Fitments Cleanup Migration

**Generated:** 2026-06-10 · **Status: NOT EXECUTED — awaiting human review**
**Basis:** `scripts/2018-INVESTIGATION-REPORT.md` (investigation of the May 7/14 TGP import)

## What this migration does

| # | Action | Expected rows | Guard |
|---|--------|---------------|-------|
| 1 | Delete `deprecated-staggered-split` 2018 rows | ~652 | Only if a `merged-staggered` replacement exists (verified per-row by base-trim match); orphans are kept |
| 2 | Split malformed makes ("Chevrolet Minivans" → "Chevrolet") | ~102 | YMMT collision check — colliding rows skipped, left for review |
| 3 | Normalize make casing (Smart→smart, RAM→Ram, etc.) | ~4+ | Canonical = majority casing table-wide, with explicit overrides; collision check |

**Explicitly NOT touched:** `bolt_pattern`, `center_bore_mm`, offsets, `oem_wheel_sizes`, `oem_tire_sizes`, `quality_tier` (no tier promotion in this migration).

Expected 2018 count after: **2,480 → ~1,828** (in line with 2017: 1,291 / 2019: 1,380 + legitimate trim granularity).

## Files

| File | Purpose | Mode |
|------|---------|------|
| `2018-cleanup-migration.sql` | The migration (transaction, backups, assertions) | **WRITE** — manual run |
| `2018-cleanup-rollback.sql` | Restore deleted rows + revert makes from backup tables | **WRITE** — manual run |
| `2018-cleanup-counts.sql` | Before/after record counts | read-only |
| `2018-cleanup-validation.sql` | 7 post-migration checks with PASS criteria | read-only |
| `2018-integrity-checks.sql` | 5 standing integrity views + summary view | creates views only |
| `generate-review-queue.mjs` | CSVs of records needing human review (missing fields) | read-only |

## Run order

```bash
# 0. BASELINE — capture before-counts (save the output!)
psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-counts.sql > before-counts.txt

# 1. Install integrity views (idempotent, safe)
psql "$POSTGRES_URL" -f scripts/migrations/2018-integrity-checks.sql

# 2. Generate the human review queue (read-only)
node scripts/migrations/generate-review-queue.mjs

# 3. THE MIGRATION — interactive psql recommended.
#    The script does NOT auto-commit: review the NOTICEs + summary,
#    then type COMMIT; (or ROLLBACK; if anything looks wrong).
psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-migration.sql
#    ... review output ...
#    COMMIT;

# 4. Validate
psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-validation.sql
psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-counts.sql > after-counts.txt
```

### ⚠️ Important notes

- **The migration does not auto-commit.** The final `COMMIT;` is commented out. Run it in interactive psql, inspect the `NOTICE` lines and summary SELECT, then commit or roll back yourself. (If you run the file non-interactively, psql will roll the open transaction back at disconnect — i.e. the default is "no changes".)
- **Backups are inside the DB:** deleted rows go to `vf_migration_2018_deleted`, make renames to `vf_migration_2018_make_changes`. Keep both tables until you're confident; the rollback script needs them.
- **Re-run protection:** the migration aborts if the backup tables are non-empty (prevents mixing two runs).
- **Built-in assertions** abort the transaction automatically if: replaceable deprecated rows survive, the backup table is empty after deletes, or renames created duplicate YMMT keys.

## Rollback (after a committed run)

```bash
psql "$POSTGRES_URL" -f scripts/migrations/2018-cleanup-rollback.sql
# review output, then COMMIT;
```

The rollback restores all deleted rows from `vf_migration_2018_deleted` and reverts make renames — skipping any row whose make was changed *again* after the migration (reported as "drifted", needs manual inspection).

## Review queue (human work, separate from migration)

`generate-review-queue.mjs` writes to `scripts/migrations/review-queue/`:

- `missing_center_bore.csv` — ~52 expected (Porsche/Ferrari/Lambo exotics + Ford SD DRW). **Backfill from OEM references; bore is safety-critical — do not guess.**
- `missing_bolt_pattern.csv` — table-wide check
- `missing_wheel_sizes.csv` / `missing_tire_sizes.csv` — table-wide check
- `review-queue-summary.json` — counts + per-make breakdown

## Integrity views (standing health checks)

After `2018-integrity-checks.sql`, query any time:

```sql
SELECT * FROM vw_integrity_summary;          -- all checks, one row each (healthy = zeros)
SELECT * FROM vw_integrity_case_dup_makes;   -- "ford" vs "Ford"
SELECT * FROM vw_integrity_category_makes;   -- "Chevrolet Minivans" leaks
SELECT * FROM vw_integrity_dup_ymmt;         -- duplicate year/make/model/trim
SELECT * FROM vw_integrity_missing_wheel_fields;
SELECT * FROM vw_integrity_year_spikes;      -- >2x neighbor-average (advisory)
```

Suggested: add `SELECT * FROM vw_integrity_summary` to `npm run pre-deploy` and fail the deploy if any non-advisory check has violations.

## Out of scope (deliberately)

- **Quality-tier promotion** for the surviving TGP records (`unknown` → `complete`) — plan-approved as a later step, after this cleanup is verified in production.
- **Center-bore backfill** — human review queue item.
- **2020-2026 Front/Rear trim leak** (~26 rows) — separate small investigation; different import origin.
- **The ~100 YMMT overlaps** between May-7 and pre-existing data — human picks survivors.
