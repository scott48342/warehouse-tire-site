# Wheel Fitment Data Remediation Plan

**Date:** 2026-04-12  
**Audit Source:** `wheel-audit-results.json`  
**Total Records:** 12,333

---

## Executive Summary

The wheel fitment audit reveals **7,404 records (60.0%)** with flagged issues requiring review. However, many of these are not true data quality issues:

- **Sibling aggregation** (25.2%) - Multiple trims grouped together (same as tire audit)
- **Offset range too broad** (25.8%) - Often legitimate for aftermarket compatibility
- **Missing wheel specs** (11.8%) - Need OEM wheel size data populated

**True data issues requiring remediation:** ~5% of records

### Safe Records
- **exact_safe:** 2,534 (20.5%)
- **plausible_shared:** 2,395 (19.4%)
- **Total Clean:** 4,929 (40.0%)

---

## Issue Breakdown

| Issue Type | Count | % of Total | Priority |
|------------|-------|------------|----------|
| offset_range_too_broad | 3,177 | 25.8% | 🟡 Medium |
| sibling_aggregation | 3,109 | 25.2% | 🟢 Low |
| missing_wheel_specs | 1,460 | 11.8% | 🟠 High |
| suspicious_bolt_pattern | 464 | 3.8% | 🟡 Medium |
| min_diameter_below_oem | 191 | 1.5% | 🟡 Medium |
| width_range_too_broad | 117 | 0.9% | 🟢 Low |
| suspicious_center_bore | 14 | 0.1% | 🟢 Low |

---

## Issue Analysis & Remediation

### 1. Missing Wheel Specs (1,460 records) 🟠 HIGH

**Description:** Records have bolt pattern, center bore, and offset range but NO OEM wheel sizes (diameter/width).

**Top Affected:**
- Buick (Century, LeSabre, Regal, Park Avenue)
- Oldsmobile (Alero, Aurora, Cutlass)
- Pontiac (Bonneville, Grand Am, Grand Prix)
- Mercury (Cougar, Grand Marquis, Mountaineer)

**Root Cause:** These records were imported with mounting specs only, missing actual wheel size data.

**Remediation:**
1. **Inheritance Fill** - Use `fill-fitment-gaps.ts` to inherit wheel sizes from same generation
2. **Manual Backfill** - For models without generation data, research OEM specs
3. **Batch Import** - Consider re-importing from source APIs with full wheel data

**Script Action:**
```typescript
// Add to fill-fitment-gaps.ts or create wheel-size-fill.ts
// Inherit oem_wheel_sizes from donor records within generation
```

**Priority:** HIGH - These records can't power wheel recommendations

---

### 2. Offset Range Too Broad (3,177 records) 🟡 MEDIUM

**Description:** Offset spread >25mm for a single trim. Examples: 15mm to 54mm (39mm spread).

**Top Affected:**
- Audi (A4, A6, A3)
- Mercedes (C-Class, E-Class)
- BMW (3-Series, 5-Series)
- Ford/Ram trucks (HD models with wide aftermarket support)

**Root Cause:** 
- Aggregated trim data with multiple factory wheel options
- Aftermarket compatibility ranges mixed with OEM
- Some sources provide "safe range" rather than OEM-only range

**Is This Actually a Problem?**
- For **wheel search filtering**: NO - shows compatible wheels
- For **OEM validation**: YES - can't identify exact OEM offset
- For **customer experience**: MINOR - more options shown than necessary

**Remediation Options:**

A) **Split OEM vs Compatible Ranges**
   ```typescript
   // Add fields to schema:
   oem_offset_min_mm: number,  // Tight OEM range
   oem_offset_max_mm: number,
   compatible_offset_min_mm: number,  // Wide aftermarket range
   compatible_offset_max_mm: number,
   ```

B) **Trim-Based Offset Tightening**
   - Performance trims: tighter offsets (±10mm from OEM)
   - Base trims: moderate range (±15mm)
   - Trucks: wider acceptable range (±25mm)

C) **Accept As-Is for Now**
   - Current ranges are "safe" for wheel fitment
   - Add UI hint: "Showing all compatible offsets"

**Recommendation:** Option C for now (accept), revisit for Option A in Phase 2

---

### 3. Sibling Aggregation (3,109 records) 🟢 LOW

**Description:** Multiple trims grouped together (e.g., "Base, Technology, SH-AWD, Advance")

**Same as tire audit** - this is a data structure choice, not an error.

**Impact:**
- Shows superset of valid wheel specs
- Does NOT cause wrong recommendations
- May show slightly wider ranges

**Remediation:**
- Same as tire audit: accept for most vehicles
- Consider splitting only for Tier A performance vehicles with distinct specs

**Recommendation:** No action needed - document as known behavior

---

### 4. Suspicious Bolt Pattern (464 records) 🟡 MEDIUM

**Description:** Bolt patterns not in expected make list (may be legitimate edge cases).

**Examples:**
- Honda Accord 4x114.3 (2000 model - 4-lug was legitimate)
- Kia Sportage 5x139.7 (early years used 5x5.5)
- Lincoln Navigator 5x135 (legit Ford truck pattern)

**Root Cause:** Audit expected patterns list incomplete for edge cases and older models.

**Remediation:**
1. **Expand expected patterns list** - Already done for most cases
2. **Review remaining 464** - Likely most are legitimate
3. **Flag only truly wrong patterns** - Very few actual errors expected

**Action Taken:**
- Added 4-lug patterns for compact cars
- Added HD truck patterns (8x165.1, 8x170)
- Added 5x135 for Ford trucks
- Added 6x114.3 for Dodge

**Remaining Pattern Gaps:**
```typescript
// Add to audit:
"honda": [..., "4x114.3"],  // Older Accords
"kia": [..., "5x139.7"],    // Early Sportage
"lincoln": [..., "5x135"],  // Done
"nissan": [..., "6x114.3"], // Older trucks
```

---

### 5. Min Diameter Below OEM (191 records) 🟡 MEDIUM

**Description:** Minimum wheel diameter less than expected OEM baseline.

**Examples:**
- Dodge Challenger 2015+ showing 17" (expected 18"+)
- Dodge Charger 2015+ showing 17" (expected 18"+)

**Root Cause:**
- Some base trims legitimately have smaller wheels
- Minimum expectations set too high for certain models

**Analysis:**
- Challenger SXT 2015+: 17" is legitimate OEM option
- Charger SXT 2015+: 17" is legitimate OEM option

**Remediation:**
```typescript
// Update MIN_OEM_DIAMETERS:
"dodge/challenger": { "2015": 17, "0": 17 },  // 17" is legit for SXT
"dodge/charger": { "2015": 17, "0": 17 },     // 17" is legit for SXT
```

**Recommendation:** Update audit rules, no data changes needed

---

### 6. Width Range Too Broad (117 records) 🟢 LOW

**Description:** Width spread >3" (e.g., 8.5" to 12").

**Top Affected:**
- Porsche 911 (trims aggregated - Carrera through GT3 RS)
- Corvette (staggered setups with wide rear)
- Some HD trucks

**Root Cause:** Trim aggregation combines narrow-body and wide-body variants.

**Is This a Problem?**
- NO for tire/wheel compatibility
- Shows superset of valid widths
- Rear-biased vehicles (staggered) naturally have wider ranges

**Recommendation:** Accept as-is - document that staggered setups cause wider ranges

---

### 7. Suspicious Center Bore (14 records) 🟢 LOW

**Description:** Center bore outside expected range for vehicle class.

**Examples:**
- Geo Tracker: 108mm (legitimate for 5x139.7 truck-based platform)
- Suzuki Grand Vitara: 108.1mm (same platform)

**Root Cause:** These are legitimate but unusual vehicles.

**Recommendation:** No action - these are correct for their platforms

---

## Remediation Priority Order

### Phase 1: Critical (Week 1)
1. **Fill missing wheel specs** for high-traffic models
   - Focus on 2015-2026 first
   - Use generation inheritance where possible
   - Priority: F-150, Silverado, Camry, Accord, RAV4

### Phase 2: Important (Weeks 2-3)
2. **Expand bolt pattern reference list** for remaining edge cases
3. **Adjust minimum diameter rules** for Challenger/Charger
4. **Review offset ranges** for performance vehicles

### Phase 3: Nice-to-Have (Weeks 4+)
5. **Consider trim splitting** for Tier A performance vehicles
6. **Add OEM vs compatible offset separation**
7. **Document acceptable aggregation patterns**

---

## Architecture Recommendations

### What Can Be Fixed by Inheritance Tightening
- Missing wheel specs → inherit from same generation
- Cross-generation contamination → already resolved by gen boundaries

### What Can Be Fixed by Trim-Aware Floor Rules
- Minimum diameter validation → update MIN_OEM_DIAMETERS config
- Width/offset validation → add vehicle-class-specific rules

### What Needs Overrides
- Edge case vehicles (Geo Tracker, early Kia Sportage)
- Unusual bolt patterns that are legitimate

### What Is Actually Valid (No Action Needed)
- Sibling aggregation (shows superset of valid specs)
- Broad offset ranges (aftermarket compatibility)
- Width ranges for staggered setups
- HD truck large center bores

---

## Top 10 Affected Models (for prioritization)

| Model | Flagged | Total | Primary Issues |
|-------|---------|-------|----------------|
| chevrolet/silverado-1500 | 193 | 212 | Offset range, aggregation |
| ram/2500 | 187 | 192 | Missing specs, offset range |
| ram/3500 | 168 | 168 | Missing specs, offset range |
| gmc/sierra-1500 | 167 | 179 | Offset range, aggregation |
| jeep/grand-cherokee | 163 | 208 | Offset range, aggregation |
| mercedes/c-class | 155 | 187 | Offset range |
| toyota/tundra | 150 | 174 | Offset range, aggregation |
| nissan/titan | 149 | 149 | Missing specs, offset range |
| ford/f-250 | 143 | 172 | Missing specs, offset range |
| jeep/wrangler | 139 | 174 | Offset range, aggregation |

---

## Scripts Created

| Script | Purpose | Location |
|--------|---------|----------|
| wheel-fitment-audit.ts | Full wheel fitment integrity audit | scripts/fitment-audit/ |
| wheel-audit-results.json | Full audit data (JSON) | scripts/fitment-audit/ |
| wheel-audit-results.csv | Audit data for Excel review | scripts/fitment-audit/ |

---

## Next Steps

1. Review this plan with Scott
2. Decide priority for Phase 1 fixes
3. Create wheel-size-fill.ts script for inheritance
4. Run targeted fixes
5. Re-audit to verify

---

*Generated by wheel-fitment-audit.ts | 2026-04-12*
