# Wheel Diameter Validation Report

**Date:** 2026-04-12  
**Scope:** 38 sampled vehicles across GM, Ford, Ram, Toyota, Nissan, luxury/performance segments

## Executive Summary

The 92% multi-diameter rate is **REAL but PARTIALLY INCORRECT** due to a data quality issue:

| Finding | Status |
|---------|--------|
| Phase 1 wheel diameter selector | ✅ CORRECT UX |
| Multi-diameter rate (92%) | ⚠️ INFLATED by bad data |
| Root cause | 🔴 `generation_inherit` source |

## Key Findings

### 1. Multi-Diameter is Expected (Partially)
Most modern vehicles genuinely offer multiple OEM wheel size options:
- Tesla Model Y: 19"/20"/21" ✅
- Cadillac Escalade: 22"/24" ✅  
- Ford Bronco: 16"/17"/18" ✅

### 2. Data Quality Issue Discovered
**Source: `generation_inherit`** (872 records, 20% of 2020+ data)

This import process incorrectly inherits tire sizes from **historical vehicle generations**, not current ones:

| Vehicle | Shown | Reality |
|---------|-------|---------|
| 2026 Corvette Stingray | 15" (P225/70R15) | 19"/20" |
| 2026 Silverado RST | 15"/16" | 20"/22" |
| 2026 F-150 Raptor | 16"/17" | 17" (35-37" tires) |

The 15" and 16" sizes are from **1970s-1980s vehicles**, not modern trucks/sports cars.

### 3. Good Data Sources
These sources have correct tire sizes:
- `generation_template` (158 records) ✅
- `cache-import` (699 records) ✅
- `generation` (204 records) ✅
- `tier-a-import` (197 records) ✅
- `api_import` (380 records) ✅

### 4. Sample Results

| Verdict | Count | % |
|---------|-------|---|
| ✅ CORRECT | 22 | 57.9% |
| ⚠️ FALSE MULTI | 15 | 39.5% |
| 🔶 SUSPICIOUS | 1 | 2.6% |

## Phase 1 Architecture Validation

**Phase 1 wheel diameter selector is CORRECT:**
- Protects users from seeing wrong tire sizes
- Filters tire sizes by selected wheel diameter
- Works correctly for lifted builds (bypass)

**No regression risk** - Phase 1 improves UX regardless of underlying data quality.

## Data Fix Recommendations

### Option A: Fix `generation_inherit` Source (Recommended)
1. Identify all `generation_inherit` records
2. Cross-reference with correct OEM specs
3. Update tire sizes to current generation values
4. Re-run import with correct source data

### Option B: Quarantine Bad Data
1. Add `data_quality` flag to fitment records
2. Mark `generation_inherit` records as "needs_review"
3. Exclude from user-facing queries until verified

### Option C: Manual Override for High-Volume Vehicles
Priority vehicles to fix immediately:
1. Silverado 1500 (all trims)
2. F-150 (all trims)
3. Sierra 1500 (all trims)
4. RAM 1500 (all trims)
5. Corvette (all trims)

## Records Affected

```
Total 2020+ fitments: ~4,291
├── generation_inherit: 872 (20.3%) ⚠️ BAD
├── generation-baseline: 711 (16.6%)
├── cache-import: 699 (16.3%) ✅
├── api_import: 380 (8.9%) ✅
├── generation_import: 316 (7.4%)
└── Other sources: 1,313 (30.5%)
```

## Conclusion

1. **Phase 1 is safe** - No changes needed to the wheel diameter selector
2. **Data needs fixing** - The `generation_inherit` source has incorrect tire sizes
3. **92% figure is inflated** - True multi-diameter rate is ~60-70% (still expected)
4. **No regression from Phase 1** - It's protective regardless of data quality

## Next Steps

1. ✅ Keep Phase 1 wheel diameter selector (deployed)
2. 🔄 Create data cleanup script for `generation_inherit` records
3. 📊 Re-run validation after cleanup to verify <10% issue rate
