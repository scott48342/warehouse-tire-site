# Phase 3: Priority Model Gap Analysis

**Date:** 2026-04-12
**Focus:** Non-HD high-value gaps

---

## Current Baseline Snapshot

### Wheel Integrity
| Metric | Count | % |
|--------|-------|---|
| Total Records | 12,333 | 100% |
| Clean/Safe | 5,677 | 46.0% |
| **missing_wheel_specs** | **488** | 4.0% |
| exact_safe | 3,087 | 25.0% |
| plausible_shared | 2,590 | 21.0% |
| offset_range_too_broad | 3,094 | 25.1% |
| sibling_aggregation | 3,109 | 25.2% |

### Tire Integrity
| Metric | Count | % |
|--------|-------|---|
| Total Records | 12,333 | 100% |
| Flagged | 3,964 | 32.1% |
| **missing_specs** | **0** | 0% ✅ |
| **cross_gen_contamination** | **0** | 0% ✅ |
| sibling_aggregation | 3,638 | 29.5% |

---

## Priority Model Analysis

### 1. chevrolet/silverado-1500 (27 missing)

**Pattern:** Exactly 1 "Base" trim missing per year (2000-2026)
**Donors Available:** 4-6 trims per year with data (LS, LT, WT, Z71, SS)
**Platform:** Same wheel specs across trims for light-duty 1500

| Year Range | Platform | Bolt | Donors |
|------------|----------|------|--------|
| 1999-2006 | GMT800 | 6x139.7 | LS, LT |
| 2007-2013 | GMT900 | 6x139.7 | LS, LT, Z71 |
| 2014-2018 | K2XX | 6x139.7 | LS, LT, Z71 |
| 2019-2026 | T1XX | 6x139.7 | LS, LT, RST |

**Strategy:** Same-year donor fill (high confidence)
**Risk:** None - same platform, just different trim level

---

### 2. cadillac/escalade-esv (24 missing)

**Pattern:** All records missing wheel specs (0 have data)
**Donors Available:** 
- Regular Escalade: 26 records with data
- Tahoe: 27 records with data
- Suburban: 12 records with data

**Platform:** GMT/K2XX/T1XX full-size SUV (same as Tahoe/Suburban/Escalade)

| Year Range | Donor Options |
|------------|---------------|
| 2003-2006 | Escalade, Suburban |
| 2007-2014 | Escalade, Tahoe, Suburban |
| 2015-2020 | Escalade, Tahoe |
| 2021-2026 | Escalade, Tahoe |

**Shared Specs (verified):**
- Bolt: 6x139.7
- Center bore: 78.1mm

**Strategy:** Cross-model donor fill (same platform, same specs)
**Risk:** Low - Escalade-ESV is literally a stretched Escalade

---

### 3. chevrolet/suburban (21 missing)

**Pattern:** 21 missing, 12 with data
**Donors Available:** Same-year Tahoe, Yukon, Escalade

**Platform:** Same as Tahoe/Yukon/Escalade

**Strategy:** Same-year + cross-model donor fill
**Risk:** None - direct platform sibling

---

### 4. gmc/yukon (20 missing)

**Pattern:** 20 missing, 13 with data
**Donors Available:** Same-year Tahoe, Suburban, Escalade

**Strategy:** Same-year + cross-model donor fill
**Risk:** None - direct platform sibling

---

### 5. gmc/yukon-xl (15 missing)

**Pattern:** 15 missing (2000-2014 only)
**Donors:** Suburban, Yukon, Escalade-ESV

**Strategy:** Cross-model donor fill
**Risk:** None - direct platform sibling

---

## Recommended Fill Strategy

### Approach: Same-Platform Donor Discovery

1. **For each missing record:**
   - Find same-year, same-platform records with valid wheel specs
   - Priority order: same-model > platform-sibling > cross-make sibling

2. **Platform Sibling Groups:**
   ```
   GROUP A (1500/half-ton):
   - Silverado-1500, Sierra-1500
   
   GROUP B (Full-size SUV):
   - Tahoe, Suburban, Yukon, Yukon-XL, Escalade, Escalade-ESV
   ```

3. **Validation Rules:**
   - Must match bolt pattern
   - Must match center bore (±1mm tolerance)
   - Prefer same-year donor
   - Year gap max: 2 years within same generation

### Expected Results

| Model | Missing | Fillable | Confidence |
|-------|---------|----------|------------|
| Silverado-1500 | 27 | 27 | High |
| Escalade-ESV | 24 | 24 | High |
| Suburban | 21 | 21 | High |
| Yukon | 20 | 20 | High |
| Yukon-XL | 15 | 15 | High |
| **Total** | **107** | **107** | |

---

## Risks Before Proceeding

### ✅ Safe to Proceed
1. **Platform consistency** - All targets share well-documented GM platforms
2. **Abundant donors** - Multiple sibling models with data
3. **Spec verification** - Bolt patterns and center bores confirmed matching
4. **No HD truck complexity** - These are light-duty/SUV platforms

### ⚠️ Minor Concerns
1. **2021+ Escalade/Yukon generation change** - New T1XX platform, but specs are similar
2. **Sibling aggregation** - Some donor records have grouped trims, but base specs are correct

### ❌ No Blockers Identified

---

## Implementation Plan

1. Create `fill-priority-models.ts` script
2. Implement platform-sibling donor discovery
3. Dry-run and validate matches
4. Apply fill with full logging
5. Re-run wheel audit to confirm improvement

**Expected outcome:** missing_wheel_specs from 488 → ~381 (-107)
