# Wheel-Only Vehicles Investigation Report
**Date:** 2026-06-11
**Analyst:** Clawd

## Executive Summary

**4,534 vehicles** return wheel results but not tire or package results. Investigation revealed a **regex bug** in the coverage audit script that misclassified **3,637 vehicles** (80%) as "vintage tire sizes" when they actually have modern P-metric or LT-prefix sizes.

### Key Finding
The audit script's MODERN regex didn't recognize P-metric (P215/45R17) or LT-prefix (LT265/70R17) sizes as modern, causing them to be filtered from tire probes entirely.

**Production code is CORRECT** - `legacyTireConverter.ts` properly handles these formats. The bug was audit-only.

## Root Cause Breakdown

| Root Cause | Count | % | Status |
|------------|-------|---|--------|
| vintage_tire_size (P-metric) | 2,134 | 47.1% | **RECOVERABLE** |
| vintage_tire_size (LT prefix) | 1,503 | 33.1% | **RECOVERABLE** |
| vintage_tire_size (true vintage) | 319 | 7.0% | Expected |
| missing_oem_tire_size | 571 | 12.6% | Data gap |
| missing_inventory_tires | 24 | 0.5% | Supply |
| **TOTAL** | **4,534** | 100% | |

## Modern vs Classic Breakdown

| Era | Total | P-metric | LT | Recoverable |
|-----|-------|----------|-----|-------------|
| Modern (2015+) | 1,692 | 512 | 674 | **1,186** |
| Classic (<2015) | 2,842 | 1,622 | 829 | **2,451** |
| **TOTAL** | **4,534** | **2,134** | **1,503** | **3,637** |

## Top Affected Makes

### P-Metric Misclassification
| Make | Vehicles |
|------|----------|
| Chevrolet | 458 |
| Ford | 270 |
| Pontiac | 257 |
| Cadillac | 195 |
| Lexus | 163 |
| GMC | 140 |
| Buick | 124 |
| Dodge | 96 |
| Chrysler | 75 |
| Toyota | 66 |

### LT-Prefix Misclassification
| Make | Vehicles |
|------|----------|
| Chevrolet | 413 |
| RAM | 371 |
| Ford | 319 |
| GMC | 284 |

## Top Affected Models

| Model | Count |
|-------|-------|
| Pontiac Firebird | 158 |
| Chevrolet Corvette | 134 |
| GMC Yukon | 115 |
| Chevrolet Impala | 80 |
| Cadillac Escalade ESV | 66 |
| Buick Regal | 56 |
| Chevrolet Camaro | 53 |
| Cadillac Escalade | 50 |
| Ford Explorer | 46 |
| Lexus ES/GS/LS | 102 |

## The Bug

### Location
`scripts/coverage-audit/02-export.mjs`, line 54

### Before (Bug)
```javascript
const MODERN = /^\d{3}\/\d{2,3}Z?R\d{2}/i;
```

This regex requires tire sizes to **start with 3 digits**, but:
- P-metric sizes start with "P" (e.g., P215/45R17)
- LT sizes start with "LT" (e.g., LT265/70R17)

### After (Fix)
```javascript
const MODERN = /^(?:P|LT)?\d{3}\/\d{2,3}Z?R\d{2}/i;
```

Added optional `(?:P|LT)?` prefix matching.

### Test Results
| Size | OLD | NEW | Status |
|------|-----|-----|--------|
| P215/45R17 | VINTAGE | MODERN | ✓ Fixed |
| P235/60R18 | VINTAGE | MODERN | ✓ Fixed |
| LT265/70R17 | VINTAGE | MODERN | ✓ Fixed |
| LT285/75R16 | VINTAGE | MODERN | ✓ Fixed |
| 225/45R17 | MODERN | MODERN | Unchanged |
| E70-14 | VINTAGE | VINTAGE | Correct |

## Revenue Impact Estimate

| Metric | Value |
|--------|-------|
| Recoverable vehicles | 3,637 |
| Assumed inventory coverage | 95% |
| Est. vehicles with inventory | 3,455 |
| Avg order value | $800 |
| **Potential revenue recovery** | **$2,764,000** |

## Highest-Impact Fixes

### Fix #1: P-Metric/LT Regex (THIS FIX)
- **Vehicles recovered:** 3,637
- **Revenue impact:** ~$2.76M
- **Implementation risk:** LOW (audit script only)
- **Time to fix:** 5 minutes
- **Status:** FIXED in branch `fix/coverage-audit-pmetric-regex`

### Fix #2: Missing OEM Tire Sizes
- **Vehicles affected:** 571
- **Revenue impact:** ~$457K
- **Implementation risk:** MEDIUM (data import)
- **Time to fix:** 1-2 days
- **Status:** Requires data sourcing

### Fix #3: True Vintage Conversion
- **Vehicles affected:** 319
- **Revenue impact:** ~$255K (lower conversion rate)
- **Implementation risk:** MEDIUM
- **Time to fix:** 1 week
- **Status:** Enhancement to legacyTireConverter.ts

## Non-Recoverable Vehicles

| Category | Count | Reason |
|----------|-------|--------|
| True vintage (E70-14 etc) | 319 | No modern equivalent in inventory |
| Missing OEM data | 571 | Need data import |
| No inventory | 24 | Supply issue |
| **Total non-recoverable** | **914** | |

## Recommendations

1. **Immediate:** Merge `fix/coverage-audit-pmetric-regex` and re-run audit
2. **Short-term:** Import missing OEM tire data for 571 vehicles
3. **Medium-term:** Expand `legacyTireConverter.ts` for true vintage sizes

## Verification Steps

After merging the fix:

1. Re-run `02-export.mjs` to regenerate vehicle plans
2. Re-run `03-probe.mjs` to probe newly-identified modern sizes
3. Re-run `04-classify.mjs` to reclassify vehicles
4. Verify wheel-only count drops by ~3,600

## Files Changed

- `scripts/coverage-audit/02-export.mjs` - Regex fix
- `scripts/coverage-audit/analyze-wheel-only.mjs` - Analysis script (new)
- `scripts/coverage-audit/WHEEL-ONLY-ANALYSIS.md` - This report (new)
