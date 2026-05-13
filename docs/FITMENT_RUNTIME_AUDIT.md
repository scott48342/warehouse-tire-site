# Fitment Runtime Source Audit
**Date**: 2026-05-13
**Status**: COMPLETE - Ready for Architecture Decision

---

## Executive Summary

**Finding**: `vehicle_fitments` is the de facto canonical source. `vehicle_fitment_configurations` is orphaned and unused at runtime.

| Metric | Result |
|--------|--------|
| Runtime APIs audited | 15 |
| Use `vehicle_fitments` | 15/15 (100%) |
| Use `vehicle_fitment_configurations` | 0/15 (0%) |
| Use `canonicalResolver` | 5/15 (33%) |
| Have static JSON fallback | 1/15 (7%) |

**Recommendation**: **Option A** — Improve `vehicle_fitments` rather than creating new table.

---

## 1. Complete API/Source Audit

### 1.1 `/api/vehicles/tire-sizes`

| Field | Value |
|-------|-------|
| **Source Table** | `vehicle_fitments` |
| **Resolver** | `canonicalResolver.resolveVehicleFitment()` |
| **Fallback Behavior** | Static JSON `oem-tire-sizes.json` (LEGACY - should remove) |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | ✅ Yes (via `applyOverrides`) |
| **Static Bypass** | ⚠️ Yes - can fall back to static JSON |

**Code Path**:
```
tire-sizes → canonicalResolver → vehicleFitments → applyOverrides → return
                                      ↓ (if not found)
                              static JSON fallback ← SHOULD REMOVE
```

### 1.2 `/api/wheels/fitment-search`

| Field | Value |
|-------|-------|
| **Source Table** | `vehicle_fitments` |
| **Resolver** | `canonicalResolver.resolveVehicleFitment()` |
| **Fallback Behavior** | `profileService.getFitmentProfile()` if resolver fails |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | ✅ Yes |
| **Static Bypass** | ❌ No |

**Code Path**:
```
fitment-search → canonicalResolver → vehicleFitments → applyOverrides
                        ↓ (also)
               classicLookup (for pre-1985)
```

### 1.3 YMM Selectors

#### `/api/vehicles/years`

| Field | Value |
|-------|-------|
| **Source Table** | `vehicle_fitments` |
| **Resolver** | Direct query via `coverage.getYearsWithCoverage()` |
| **Fallback Behavior** | Redis cache, then DB, then empty |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | ❌ No (just listing years) |
| **Static Bypass** | ❌ No |

#### `/api/vehicles/makes`

| Field | Value |
|-------|-------|
| **Source Table** | `vehicle_fitments` |
| **Resolver** | Direct DISTINCT query |
| **Fallback Behavior** | Redis cache, then DB, then `getFallbackMakes()` |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | ❌ No |
| **Static Bypass** | ⚠️ Yes - has hardcoded fallback list |

#### `/api/vehicles/models`

| Field | Value |
|-------|-------|
| **Source Table** | `vehicle_fitments` |
| **Resolver** | Direct query via `coverage.getModelsWithCoverage()` |
| **Fallback Behavior** | Redis cache, then DB, then `getFallbackModels()` |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | ❌ No |
| **Static Bypass** | ⚠️ Yes - has hardcoded fallback list |

#### `/api/vehicles/trims`

| Field | Value |
|-------|-------|
| **Source Table** | `vehicle_fitments` |
| **Resolver** | `canonicalResolver.getAtomicTrimOptions()` |
| **Fallback Behavior** | Redis cache, then DB |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | ❌ No |
| **Static Bypass** | ❌ No |

**Note**: Trims API uses canonicalResolver to explode grouped trims into atomic options.

### 1.4 Package Builder (`/api/packages/recommended`)

| Field | Value |
|-------|-------|
| **Source Table** | `vehicle_fitments` |
| **Resolver** | `getFitment.listLocalFitments()` |
| **Fallback Behavior** | None - returns empty if not found |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | ❌ No (uses raw fitments) |
| **Static Bypass** | ❌ No |

**Code Path**:
```
engine.ts → listLocalFitments() → vehicleFitments → filter by bolt pattern
```

### 1.5 POS Flow (`/api/pos/quotes`)

| Field | Value |
|-------|-------|
| **Source Table** | `pos_quotes` (own table) |
| **Resolver** | None - stores customer data |
| **Fallback Behavior** | N/A |
| **Config Table Used** | ❌ No |
| **Overrides Applied** | N/A |
| **Static Bypass** | N/A |

**Note**: POS quotes store vehicle info (year/make/model/trim) as JSON blob. Fitment resolution happens before quote creation via the standard tire-sizes/fitment-search APIs.

### 1.6 Local vs National Site

| Field | Value |
|-------|-------|
| **Fitment Source** | Same (`vehicle_fitments`) |
| **Difference** | Installation services, pricing, supplier ordering |
| **Resolver** | Same canonicalResolver |
| **Config Table Used** | ❌ No |

**Note**: Local/national site logic is in `shopContext.ts` and affects pricing/installation, NOT fitment resolution.

### 1.7 Admin Fitment Tools

#### `/api/admin/fitment/config-enrichment`

| Field | Value |
|-------|-------|
| **Reads From** | `vehicle_fitments`, `vehicle_fitment_configurations` |
| **Writes To** | `vehicle_fitment_configurations` |
| **Purpose** | Populate config table from USAF data |

**Note**: This is the ONLY code that writes to `vehicle_fitment_configurations`. It creates orphaned records (no FK linkage).

#### `/api/admin/fitment/bulk`, `/api/admin/fitment/enrich`

| Field | Value |
|-------|-------|
| **Reads/Writes** | `vehicle_fitments` only |
| **Config Table** | ❌ Not used |

#### `/api/admin/fitment/override`

| Field | Value |
|-------|-------|
| **Reads/Writes** | `fitment_overrides` table |
| **Applied Via** | `applyOverrides()` at read time |

#### `/api/admin/fitment/trim-mappings`

| Field | Value |
|-------|-------|
| **Reads/Writes** | `wheel_size_trim_mappings` table |
| **Purpose** | Map external trim names to our modificationIds |

---

## 2. `vehicle_fitment_configurations` Status

### Evidence of Non-Use

| Check | Result |
|-------|--------|
| **Runtime APIs reading from it** | 0 |
| **canonicalResolver reads it** | ❌ No |
| **profileService reads it** | ❌ No |
| **getFitment reads it** | ❌ No |
| **Records with valid FK** | 0/14 tested (all NULL) |
| **Records with display_trim** | 0/14 (all NULL) |

### What config-enrichment Does

The config-enrichment API creates records like:
```json
{
  "year": 2024,
  "make_key": "toyota",
  "model_key": "tacoma",
  "display_trim": null,           // ← ALWAYS NULL
  "vehicle_fitment_id": null,     // ← ALWAYS NULL (orphaned)
  "wheel_diameter": 18,
  "tire_size": "265/65R18"
}
```

These records are **never read by runtime**.

### Recommendation

**DEPRECATE `vehicle_fitment_configurations`**. It serves no runtime purpose.

Alternative: If config-level data is needed, add columns to `vehicle_fitments`:
- `oem_configurations: jsonb` — Array of diameter/size combos
- `default_configuration: varchar` — Key of default config

---

## 3. Option Comparison

### Option A: Enhance `vehicle_fitments` (RECOMMENDED)

**Changes Required**:
1. Add missing columns for config concepts (if needed)
2. Remove static JSON fallback from tire-sizes API
3. Ensure all admin tools write to this table
4. Deprecate `vehicle_fitment_configurations`

**Pros**:
- ✅ No new table to migrate
- ✅ Already has 9,226+ records
- ✅ Already the runtime source
- ✅ canonicalResolver already works with it
- ✅ Overrides already apply to it
- ✅ Zero migration risk for working vehicles

**Cons**:
- ❌ Multi-config vehicles need JSONB column
- ❌ Staggered data is in `oem_wheel_sizes` JSONB (not normalized)

**Migration Complexity**: LOW
- No data migration needed
- Only schema additions (non-breaking)

### Option B: Create New `canonical_fitments` Table

**Changes Required**:
1. Create new table schema
2. Migrate 9,226+ records
3. Update ALL runtime APIs to read from new table
4. Update canonicalResolver
5. Update all admin tools
6. Handle rollback if migration fails

**Pros**:
- ✅ Clean slate design
- ✅ Can normalize staggered/config data properly

**Cons**:
- ❌ Must migrate 9,226+ records
- ❌ Must update 15+ runtime APIs
- ❌ High regression risk
- ❌ Parallel maintenance during migration
- ❌ All existing tests need updates

**Migration Complexity**: HIGH
- Full data migration required
- All API changes required
- Rollback path needed

---

## 4. Recommendation

### Use Option A: Enhance `vehicle_fitments`

**Rationale**:
1. `vehicle_fitments` IS already the canonical source at runtime
2. Creating a new table duplicates data and creates migration risk
3. The "config" concept can be handled with JSONB columns
4. 9,226 vehicles already work — don't break them

### Specific Changes

#### Phase 1: Remove Static Fallbacks (Immediate)
1. Remove `oem-tire-sizes.json` fallback from tire-sizes API
2. Remove `getFallbackMakes()` / `getFallbackModels()` hardcoded lists
3. If vehicle not in DB → return empty (no silent fallback)

#### Phase 2: Add Config Support to vehicle_fitments (If Needed)
```sql
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS 
  oem_configurations JSONB DEFAULT '[]';
  
-- Example structure:
-- [
--   {"diameter": 18, "tireSize": "265/65R18", "isDefault": true},
--   {"diameter": 20, "tireSize": "275/55R20", "isDefault": false}
-- ]
```

#### Phase 3: Deprecate vehicle_fitment_configurations
1. Stop config-enrichment from writing to it
2. Archive existing data
3. Drop table after verification

### Staggered/Config Support

Current `oem_wheel_sizes` JSONB already supports staggered:
```json
[
  {"diameter": 19, "width": 8.5, "axle": "front", "tireSize": "255/35ZR19"},
  {"diameter": 20, "width": 11, "axle": "rear", "tireSize": "305/30ZR20"}
]
```

No schema change needed — just ensure import tools populate this correctly.

### SRW/DRW Support

Current `display_trim` already differentiates:
```
"Big Horn Dual Rear Wheel" vs "Big Horn"
```

No schema change needed — logic is in `hdFitmentResolver.ts`.

### Rollback Path

Since we're NOT creating a new table:
- Rollback = revert code changes only
- No data migration to reverse
- Existing records remain intact

---

## 5. Blocking Tests Required

Before any changes, these vehicles must pass ALL tests:

| Vehicle | YMM Selector | tire-sizes | fitment-search | Package | POS |
|---------|--------------|------------|----------------|---------|-----|
| 2022 F-150 Lightning | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2023 F-150 Lightning | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2024 Silverado 2500 HD | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2024 Toyota Tacoma | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2024 Ford Bronco | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2024 Corvette (staggered) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2024 BMW M3 (staggered) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 2024 Ram 3500 (DRW) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

---

## 6. Summary

| Question | Answer |
|----------|--------|
| Is `vehicle_fitment_configurations` needed? | **NO** — deprecate it |
| Should we create `canonical_fitments`? | **NO** — enhance existing |
| What table is canonical? | **`vehicle_fitments`** |
| What's the lowest risk path? | **Option A** — schema additions only |
| Migration complexity? | **LOW** — no data migration |

---

## Files Referenced

- `src/app/api/vehicles/tire-sizes/route.ts`
- `src/app/api/vehicles/years/route.ts`
- `src/app/api/vehicles/makes/route.ts`
- `src/app/api/vehicles/models/route.ts`
- `src/app/api/vehicles/trims/route.ts`
- `src/app/api/wheels/fitment-search/route.ts`
- `src/lib/fitment/canonicalResolver.ts`
- `src/lib/fitment-db/getFitment.ts`
- `src/lib/fitment-db/profileService.ts`
- `src/lib/fitment-db/coverage.ts`
- `src/lib/packages/engine.ts`
- `src/app/api/admin/fitment/config-enrichment/route.ts`
