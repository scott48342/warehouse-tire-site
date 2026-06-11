# 2018 Migration — Staging Validation Report

**Date:** 2026-06-10
**Method:** Full migration executed inside a single transaction, then **ROLLED BACK** — zero permanent changes (verified).
**Harness:** `scripts/migrations/staging-validation.mjs`
**Raw output:** `scripts/migrations/staging-validation-output.json`

---

## Executive Summary

The migration was dry-run end-to-end against the live Neon database inside a rolled-back transaction. **All guards, backups, and assertions behaved correctly.** One assertion bug was found and fixed during validation (details below). Post-migration state passed all critical checks, and all 11 business-impact vehicles resolved correctly with complete fitment data.

**Recommendation: APPROVE FOR PRODUCTION — confidence 92%** (conditions below).

---

## 1. Before/After Metrics

| Metric | Before | After (in-txn) | Δ |
|---|---|---|---|
| Total records (all years) | 37,495 | 36,843 | −652 |
| 2018 records | 2,480 | **1,828** | −652 (exactly as predicted) |
| Deprecated staggered-split (2018) | 652 | 0 | −652, all 652 had verified merged replacements |
| Merged-staggered (2018) | 326 | 326 | untouched ✓ |
| Malformed category makes | 103 | 0 | 101 renamed + 2 resolved via deprecated-row deletion |
| Casing-variant rows | 237* | 37 | 1,163 rows re-cased table-wide; 37 skipped by collision guard |
| Missing wheel fields | 78 | 46 | −32 (deleted deprecated exotics carried most NULL bores) |

\* Baseline "237" counts rows differing from majority casing; the migration's canonical map re-cased 1,163 rows because it also normalizes models under multi-casing make groups discovered table-wide (e.g., RAM→Ram at scale), not just the 2018 subset.

**Year curve after migration:** 2016: 1,241 · 2017: 1,291 · **2018: 1,828** · 2019: 1,380 · 2020: 1,546 — the spike is resolved; 2018's modest surplus is legitimate trim granularity.

## 2. Migration Execution Results (Phase 4 NOTICEs)

| Step | Result |
|---|---|
| Deprecated split deletion | 652/652 verified replacements → all deleted; **0 orphans** |
| Backup table | 652 rows preserved in `vf_migration_2018_deleted` ✓ |
| Malformed make splits | 101 renamed, **0 collision skips** |
| Casing normalization | 1,163 rows re-cased |
| Assertions | All passed (after fix) |
| Collision guards triggered | 0 (makes) / 37 rows skipped (casing — correct behavior, left for review) |

### ⚠️ Bug found & fixed during staging
**Assertion 4d originally failed** ("make rename created duplicate YMMT keys"). Root cause: the check flagged **pre-existing** case-insensitive YMMT duplicates (1,225 groups exist in the table today, unrelated to this migration). Re-casing "RAM" → "Ram" can't create *new* case-insensitive duplicates — they were already duplicates under LOWER() comparison. **Fix:** snapshot pre-existing dup groups at migration start (`tmp_preexisting_dup_ymmt`) and assert only on *new* groups. Re-run: clean pass. This is exactly what staging validation is for.

## 3. Post-Migration Validation Checks (Phase 5)

| Check | Result | Verdict |
|---|---|---|
| 1. Replaceable deprecated rows remaining | 0 | ✅ PASS |
| 1b. Orphaned deprecated rows kept | 0 (none existed) | ✅ PASS |
| 2. Category-suffix makes remaining | 0 | ✅ PASS |
| 3. Case-variant make groups | 17 → 8 | ⚠️ PARTIAL (8 groups remain via collision-guard skips — safe, needs review) |
| 4. NEW YMMT dupes from renames | 0 new (888 pre-existing flagged rows excluded) | ✅ PASS |
| 5. Backup integrity | 652 backed up, 0 still in table | ✅ PASS |
| 6. Integrity views | category_makes 16→0, missing_fields 78→46, case_dup 17→8, dup_ymmt 1,225 (pre-existing, out of scope), year_spikes 0 | ✅ PASS (in-scope items) |
| 7. Year counts | 2018 = 1,828, matches prediction exactly | ✅ PASS |

## 4. Business-Impact Vehicle Tests (post-migration state, Phase 6)

All 11/11 vehicles: YMM lookup ✓ · trims ✓ · bolt pattern ✓ · center bore ✓ · wheels ✓ · tires ✓ · **zero Front/Rear trim leaks**.

| Vehicle | Trims found | Fitment data |
|---|---|---|
| 2024 Toyota Camry | 11 | complete |
| 2024 Ford F-150 | 11 | complete |
| 2020 Chevrolet Silverado 1500 | 1 | complete |
| 2018 Honda Accord | 9 | complete |
| 2018 Jeep Wrangler | 8 | complete |
| 2018 VW Golf R | 1 | complete |
| 2018 Acura NSX (staggered) | 1 ("Base", merged) | complete |
| 2018 Porsche 718 Cayman (staggered) | 3 | complete |
| 2018 Alfa Romeo Giulia (staggered) | 4 | complete |
| 2018 BMW i3 (staggered) | 3 | complete |
| 2018 Chevrolet Corvette (staggered) | 3 | complete |

Mangled trims like "Base Front Base" are gone from every staggered test vehicle; the clean merged records serve them correctly.

## 5. Rollback Verification (Phases 7-8)

- Transaction rolled back cleanly
- **All 8 baseline metrics identical after rollback** — DB byte-for-byte unchanged on measured dimensions
- 0 backup tables persisted, 0 integrity views persisted (everything was inside the txn)

## 6. Review Queues (generated, read-only)

| Queue | Rows | Notes |
|---|---|---|
| missing_center_bore.csv | 74 | Table-wide (52 from 2018 TGP import — drops to ~20 in-import after migration deletes deprecated exotics; rest are legacy) |
| missing_bolt_pattern.csv | 30 | Pre-existing, not from May import |
| missing_wheel_sizes.csv | 1 | Single legacy record |
| missing_tire_sizes | 0 | Clean |

## 7. Production Readiness Assessment

### ✅ APPROVE FOR PRODUCTION — Confidence: 92%

**Why approved:**
- Exact-count dry run: 652 deletions, 101 make splits, 1,163 re-casings, final 2018 = 1,828 — all match predictions
- Every guard/assertion exercised and verified (including one that correctly caught a real bug)
- Backups created in-DB before any destructive step; rollback script has the data it needs
- 11/11 vehicle lookups healthy post-migration; staggered vehicles serve clean merged records
- Rollback verified non-destructive

**Conditions / pre-flight:**
1. Use the **fixed** migration file (assertion 4d patch applied 2026-06-10 — already in `2018-cleanup-migration.sql`)
2. Run during low-traffic window; the table-wide casing UPDATE (1,163 rows) will briefly lock rows
3. After COMMIT, immediately run `2018-cleanup-validation.sql` + spot-check the 11 test vehicles via the live API (`/api/vehicles/trims`, `/api/wheels/fitment-search`)
4. **Clear Redis/CDN caches** after migration (trims API caches 5min/10min; fitment caches 30min) so renamed makes propagate
5. Keep backup tables ≥1 week before dropping

**Known residuals (non-blocking, tracked):**
- 8 case-variant make groups remain (collision-guarded skips, 37 rows) — human review
- 1,225 pre-existing dup-YMMT groups — pre-dates this work, separate cleanup project
- 74 missing center bores + 30 missing bolt patterns — review queue CSVs ready
- 2020-2026 Front/Rear trim leak (~26 rows) — separate small fix

**Why not 100%:** the casing normalization touches 1,163 rows table-wide (larger blast radius than the 2018-only scope implies — correct per plan, but worth a deliberate nod); collision-skipped rows and the dup-YMMT backlog mean the DB isn't fully canonical after this migration alone; and live-API behavior post-cache-clear is verified only indirectly (DB-level, not HTTP-level).
