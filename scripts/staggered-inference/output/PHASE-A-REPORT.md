# Phase A Staggered Inference Report

**Date:** 2026-05-14  
**Status:** ⚠️ ROLLED BACK

---

## Summary

| Metric | Count |
|--------|-------|
| **Records Applied** | 208 |
| **Records Rolled Back** | 208 |
| **Regressions Found** | 1 (critical) |
| **Current State** | Restored to pre-apply |

---

## Phase A Platforms Processed

| Platform | Records | Confidence |
|----------|---------|------------|
| Chevrolet Camaro | 70 | 97-99% |
| Chevrolet Corvette | 40 | 97% |
| BMW M5 | 37 | 97-99% |
| BMW M4 | 36 | 97-99% |
| BMW M3 | 25 | 97-99% |
| Ford Mustang | 0 | (no proposals) |

---

## Regression Found

### Critical: `e.match is not a function`

**Root Cause:**
- Phase A apply wrote tire sizes as objects: `{size: "285/30R20", axle: "front"}`
- Existing codebase expects strings: `"285/30R20"`
- Multiple functions call `.match()` on tire sizes, which fails on objects

**Affected Code:**
- `src/lib/packages/engine.ts:parseTireSize()`
- `src/lib/fitment-db/qualityTier.ts:hasValidTireSizes()`
- `src/lib/fitment-db/fallbackEquivalence.ts`
- `src/lib/fitment-pipeline/validation-rules.ts`

**Impact:**
- Wheel fitment search returned HTTP 500
- Package builder would fail
- Tire search affected

---

## Rollback Performed

```bash
# Rollback command used:
node scripts/staggered-inference/rollback.mjs
```

**Snapshot Used:** `phase-a-snapshot-2026-05-14T11-58-14.json`

**Verification:**
- ✅ 208 records restored
- ✅ API smoke tests passing
- ✅ Data format restored to string arrays

---

## Data Format Issue

### Current Format (working)
```json
{
  "oem_tire_sizes": ["285/30R20", "305/30R20"]
}
```

### Attempted Format (broke API)
```json
{
  "oem_tire_sizes": [
    {"size": "285/30R20", "axle": "front"},
    {"size": "305/30R20", "axle": "rear"}
  ]
}
```

---

## Required Before Re-Apply

### Option A: Code-First Approach (Recommended)
1. Update `parseTireSize()` to handle objects
2. Update `hasValidTireSizes()` to handle objects
3. Update all tire size consumers to extract `.size` from objects
4. Add migration helper: `extractTireSize(item: string | {size, axle}): string`
5. Deploy code changes
6. Re-run Phase A apply

### Option B: Schema Extension
1. Keep `oem_tire_sizes` as string array (no change)
2. Add new fields: `front_tire_size`, `rear_tire_size` (nullable strings)
3. Update apply script to write to new fields only
4. Update APIs to use new fields when present

### Option C: Dual Write
1. Keep string array for backward compatibility
2. Add `staggered_mapping` JSON field: `{front: "...", rear: "..."}`
3. APIs check `staggered_mapping` first, fall back to array

---

## Files Created

```
scripts/staggered-inference/
├── run.mjs                 # Inference pipeline
├── phase-a-apply.mjs       # Apply script (needs code fix first)
├── phase-a-qa.mjs          # QA verification
├── fix-encoding.mjs        # Fixed double-encoding issue
├── rollback.mjs            # Snapshot restore
├── smoke-test.mjs          # Production smoke test
├── wheel-fitment-verify.mjs # Wheel API verification
├── check-data.mjs          # DB inspection
└── output/
    ├── staggered-proposals-2026-05-14T11-55-08.json
    ├── phase-a-results-2026-05-14T11-58-14.json
    ├── phase-a-qa-2026-05-14T12-00-10.json
    ├── REVIEW-SUMMARY.md
    └── snapshots/
        └── phase-a-snapshot-2026-05-14T11-58-14.json
```

---

## Rollback Instructions (If Needed Again)

```bash
cd scripts/staggered-inference
node rollback.mjs
```

This restores from the snapshot file. Keep snapshot files until data format is finalized.

---

## Next Steps

1. **Decision needed:** Choose approach (A, B, or C) for storing front/rear tire data
2. **Code changes:** Implement chosen approach
3. **Deploy:** Push code changes to production
4. **Re-apply:** Run Phase A apply again
5. **Expand:** Once Phase A verified, proceed to Phase B (Porsche, GT-R, etc.)

---

## Inference Logic Validated

The inference logic itself is **correct**:
- ✅ 12/12 key trim tests passed (Camaro SS/ZL1, Corvette Stingray/Z06, BMW M3/M4/M5)
- ✅ Width-based front/rear assignment working
- ✅ Diameter-based staggered detection working
- ✅ Confidence scoring accurate

The only issue was the data format, not the inference logic.
