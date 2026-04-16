# Staggered Fitment Audit Report
**Date:** 2026-04-16
**Scope:** Retail tire sizing validation across 10 test vehicles
**Status:** 🔴 5/10 FAIL (50% pass rate)

---

## Executive Summary

The retail site has **critical issues with mixed-diameter staggered fitment**. When a customer selects wheels with different front/rear diameters (e.g., 19" front / 20" rear), the tire search returns incorrect sizes that don't match the selected wheel diameters.

### Pass/Fail by Vehicle

| Vehicle | Staggered? | Tests | Status |
|---------|------------|-------|--------|
| C8 Corvette Stingray | ✅ YES | 1/4 | ❌ FAIL |
| C7 Corvette Grand Sport | ✅ YES | 1/4 | ❌ FAIL |
| Mustang GT Performance Pack | ✅ YES | 2/4 | ❌ FAIL |
| Mustang Dark Horse | ✅ YES | 2/4 | ❌ FAIL |
| BMW M3 | ⚠️ NO (should be YES) | 3/3 | ✅ PASS |
| BMW M4 | ⚠️ NO (should be YES) | 3/3 | ✅ PASS |
| Charger Scat Pack Widebody | ⚠️ NO (should be YES) | 3/3 | ✅ PASS |
| Camaro SS 1LE | ✅ YES | 2/4 | ❌ FAIL |
| F-150 XLT | ✅ NO | 3/3 | ✅ PASS |
| Camry XSE | ✅ NO | 3/3 | ✅ PASS |

---

## Issue #1: Mixed-Diameter Stagger Fails 100%

**Severity:** 🔴 CRITICAL  
**Affected:** All staggered vehicles when user selects different front/rear wheel diameters

### Problem
When selecting wheels with different front/rear diameters (e.g., 19" front / 20" rear), the tire search API ignores the rear wheel diameter and returns tires sized only for the front wheel.

### Examples

| Vehicle | Wheels Selected | Expected Tires | Actual Tires | Result |
|---------|-----------------|----------------|--------------|--------|
| C8 Corvette | 19F/20R | R19 / R20 | R19 / R19 | ❌ |
| C7 Corvette | 19F/20R | R19 / R20 | R19 / R19 | ❌ |
| Mustang GT PP | 19F/20R | R19 / R20 | R19 / R19 | ❌ |
| Camaro SS 1LE | 19F/20R | R19 / R20 | R19 / R19 | ❌ |

### Root Cause
The `/api/tires/search` endpoint does **NOT** accept or process a `rearWheelDiameter` parameter. It only handles `wheelDiameter` (singular).

```
Current params: wheelDiameter=19&rearWheelDiameter=20
Actual behavior: Ignores rearWheelDiameter, searches only R19 sizes
```

### Impact
- Corvette C7/C8 customers selecting aftermarket 19/20 or 20/21 stagger will see **wrong tire sizes**
- Could lead to ordering tires that don't fit the rear wheels
- Affects ~5-10% of performance vehicle builds (mixed diameter stagger)

---

## Issue #2: Staggered Detection Missing for 3 Vehicles

**Severity:** 🟡 MEDIUM  
**Affected:** BMW M3, BMW M4, Charger Widebody

### Problem
These vehicles should be detected as staggered but show as "square fitment":

| Vehicle | Expected | Actual | Reason Given |
|---------|----------|--------|--------------|
| BMW M3 | Staggered | Square | "Insufficient axle-specific data" |
| BMW M4 | Staggered | Square | (no reason) |
| Charger Scat Pack WB | Staggered | Square | "All wheel specs apply to both axles" |

### Root Cause
Database records for these vehicles lack axle-specific wheel/tire data needed to trigger staggered detection.

### Impact
- These vehicles won't show staggered tire pairing UI
- Customers may get mismatched front/rear tires
- OEM tire sizes still displayed, but stagger logic not applied

---

## Issue #3: tireSize Null in Corvette Staggered Specs

**Severity:** 🟡 MEDIUM  
**Affected:** C7 & C8 Corvette

### Problem
The fitment-search API returns staggered specs with wheel dimensions but **null tire sizes**:

```json
{
  "frontSpec": { "diameter": 19, "width": 8.5, "tireSize": null },
  "rearSpec": { "diameter": 20, "width": 11, "tireSize": null }
}
```

### Root Cause
Database records have wheel specs but tire sizes not populated in staggered spec structure.

### Impact
- Tire page must compute tire sizes instead of using OEM values
- May result in non-optimal tire size recommendations

---

## What Works ✅

### Same-Diameter Stagger (Width Difference Only)
When front/rear have the **same diameter** but different widths, tire sizing works correctly:

| Vehicle | Wheels | Tires Found | Status |
|---------|--------|-------------|--------|
| Mustang GT PP | 19/19 | 255/40R19 / 275/40R19 | ✅ |
| Mustang Dark Horse | 19/19 | 255/40R19 / 275/40R19 | ✅ |
| Camaro SS 1LE | 20/20 | 285/30R20 / 305/30R20 | ✅ |
| C8 Corvette | 20/20 | 305/30ZR20 / 275/30ZR20 | ✅ |

### Square Fitment Vehicles
Non-staggered vehicles work perfectly:
- F-150 XLT: All tests pass
- Camry XSE: All tests pass

### Direct Size Search
When no OEM sizes exist for a wheel diameter, the system falls back to direct size search (`direct:R20`), which correctly uses the selected wheel diameter.

---

## Recommendations

### Immediate (P0)
1. **Add `rearWheelDiameter` support to `/api/tires/search`**
   - Accept separate front/rear wheel diameters
   - Search for appropriate tire sizes per axle
   - Use `/api/tires/staggered-search` for paired results

### Short-term (P1)  
2. **Fix staggered detection for BMW M3/M4, Charger Widebody**
   - Update database records with axle-specific wheel specs
   - Or add override rules for known staggered vehicles

3. **Populate tireSize in Corvette staggered specs**
   - Add OEM tire sizes to staggered spec structure
   - Reduces computation and ensures OEM accuracy

### Medium-term (P2)
4. **Add staggered tire size validation**
   - Warn if customer selects incompatible wheel/tire diameter combinations
   - Show error if tire R-diameter doesn't match wheel diameter

---

## Test Data Reference

### Staggered Vehicles (Expected)
| Vehicle | OEM Front | OEM Rear | Detection |
|---------|-----------|----------|-----------|
| C8 Corvette Stingray | 19×8.5 / 245/35R19 | 20×11 / 305/30R20 | ✅ Working |
| C7 Corvette Grand Sport | 19×10 / 285/30R19 | 20×12 / 335/25R20 | ✅ Working |
| Mustang GT Perf Pack | 19×9 / 255/40R19 | 19×9.5 / 275/40R19 | ✅ Working |
| Mustang Dark Horse | 19×9 / 255/40R19 | 19×9.5 / 275/40R19 | ✅ Working |
| BMW M3 | (varies) | (varies) | ❌ Not detected |
| BMW M4 | (varies) | (varies) | ❌ Not detected |
| Charger Scat Pack WB | 20×11 / 305/35R20 | 20×11 / 305/35R20 | ❌ Not detected |
| Camaro SS 1LE | 20×10 / 285/30R20 | 20×11 / 305/30R20 | ✅ Working |

### Square Vehicles (Expected)
| Vehicle | OEM Sizes | Detection |
|---------|-----------|-----------|
| F-150 XLT | 245/70R17, 265/70R17, etc. | ✅ Correct |
| Camry XSE | 215/55R17, 235/45R18, etc. | ✅ Correct |

---

## Files Changed
- Audit script: `scripts/staggered-audit-v2.js`
- Full results: `scripts/staggered-audit-v2-results.json`

## Next Steps
**DO NOT FIX YET** - This is an audit only. Review findings with team before implementing fixes.
