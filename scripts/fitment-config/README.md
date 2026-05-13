# ⚠️ DEPRECATED - Do Not Use

**This entire directory is deprecated as of 2026-05-13.**

All scripts in this directory write to `vehicle_fitment_configurations`, which is no longer the canonical fitment source.

## What Changed

The canonical fitment data source is now **`vehicle_fitments`** table only.

- `vehicle_fitment_configurations` is deprecated
- No new data should be written to the config table
- Existing data can remain for historical reference

## See Also

- [FITMENT_DATA_ARCHITECTURE.md](/docs/FITMENT_DATA_ARCHITECTURE.md) - Canonical documentation
- USAF enrichments now go directly to `vehicle_fitments.oem_tire_sizes`

## Scripts in This Directory

| Script | Purpose | Status |
|--------|---------|--------|
| `backfill-configurations.ts` | Populate config table | ❌ DEPRECATED |
| `batch-runner.ts` | Batch import to config | ❌ DEPRECATED |
| `promote-safe.ts` | Promote to config | ❌ DEPRECATED |
| `promote-staged.ts` | Staged promotion | ❌ DEPRECATED |
| All `batch*.ts` files | Historical batch imports | ❌ DEPRECATED |

**Do not run any of these scripts without explicit approval.**
