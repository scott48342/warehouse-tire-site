# Tire-Spec Integrity Audit: Remediation Plan

**Audit Date:** 2026-04-12  
**Total Records:** 12,333 (2000-2026)

## Executive Summary

| Category | Count | % | Status |
|----------|-------|---|--------|
| ✅ Exact Safe | 762 | 6.2% | No action needed |
| ✅ Plausible Multi-Diameter | 7,401 | 60.0% | No action needed |
| ⚠️ Sibling Aggregation | 3,638 | 29.5% | Review needed |
| ⚠️ Broad Diameter Spread | 299 | 2.4% | Review needed |
| ⚠️ Legacy Contamination | 213 | 1.7% | Fix needed |
| ⚠️ Cross-Gen Contamination | 20 | 0.2% | Fix needed |
| ❌ Missing Specs | 0 | 0% | ✅ Complete |
| ❌ Implausible Diameter | 0 | 0% | ✅ Complete |

**Key Finding:** 66.2% of records are clean (exact_safe + plausible_multi). Main issues are:
1. Sibling aggregation (29.5%) - grouped trims, handled by wheel diameter selector
2. Broad diameter spread (2.4%) - mostly correct for modern trucks
3. Legacy contamination (1.7%) - needs cleanup
4. Cross-gen contamination (0.2%) - needs cleanup

---

## Issue Classification & Remediation

### 1. SIBLING AGGREGATION (3,638 records - 29.5%)

**Description:** Multiple trims grouped in a single `display_trim` field (e.g., "LS, LT, RST, Z71, Premier, High Country")

**Examples:**
- 2026 Acura MDX "Base, Technology, A-Spec, Advance, Type S" → 19"/20"/21"
- 2026 Chevrolet Tahoe "LS, LT, RST, Z71, Premier, High Country" → 18"/20"/22"

**Impact:** Medium - Users see all wheel options, but Phase 1 selector lets them pick correctly

**Remediation Options:**

| Option | Effort | Benefit | Recommendation |
|--------|--------|---------|----------------|
| A. Keep grouped + wheel selector | None | Selector handles UX | ✅ **Current approach** |
| B. Split into individual records | High | Exact trim accuracy | Future enhancement |
| C. Add trim-aware API filtering | Medium | Per-trim sizes | Consider for Tier-A |

**Recommended Action:** 
- **Keep current approach** for most vehicles
- **Consider splitting only for Tier-A performance vehicles** (Mustang, Camaro, Corvette, etc.) where trim-level precision matters most

---

### 2. BROAD DIAMETER SPREAD (299 records - 2.4%)

**Description:** Single trim shows >4" wheel diameter spread

**Examples:**
- 2026 Silverado-1500 "Base" → 17"/18"/20"/22" (5" spread)
- 2026 F-150 "Lariat" → 17"/18"/20"/22" (5" spread)
- 2024 BMW X5 "Base" → 18"/19"/20"/21"/22" (4" spread)

**Analysis:**
- **83% are trucks/SUVs** - This is actually CORRECT. Modern full-size trucks offer 4-5 wheel size options from factory
- **12% are luxury vehicles** - Also correct, luxury brands offer extensive customization
- **5% may be data issues** - Review case-by-case

**Remediation:**

| Action | Count | Notes |
|--------|-------|-------|
| No change (correct data) | ~250 | Trucks/SUVs with factory options |
| Review individually | ~49 | May need trim-level split |

**Recommended Action:** 
- **No mass change needed** - Phase 1 wheel selector handles this correctly
- **Document that trucks/SUVs legitimately have broad diameter options**

---

### 3. LEGACY CONTAMINATION (213 records - 1.7%)

**Description:** Modern vehicles (2015+) showing tire sizes with diameters below expected minimums

**Examples:**
- 2026 BMW 3-Series "Base" → includes 16" (expected min 17")
- 2026 Ford Bronco "Base" → includes 16" (expected min 17")
- 2026 Mustang "EcoBoost" → includes 17" (expected min 18")

**Root Cause Analysis:**
- Some 16" options ARE valid for economy/base models
- BMW/Mercedes do offer 16" for select markets
- Bronco base has 16" option (Sasquatch package steel wheels)
- Mustang EcoBoost does come with 17" base option

**Remediation:**

| Vehicle Class | Min Expected | Current Min | Action |
|---------------|--------------|-------------|--------|
| Sports Cars (2020+) | 18" | 17" | ⚠️ Review |
| Trucks/SUVs (2020+) | 17" | 16" | ✅ Some valid |
| Luxury (2020+) | 17" | 16" | ✅ Some valid |
| Economy (2020+) | 15" | 15" | ✅ Correct |

**Recommended Action:**
1. **Review the 213 flagged records manually** - many may be false positives
2. **Adjust heuristics** - 16" is valid for some modern vehicles
3. **Only fix clear errors** (e.g., 15" on 2024 Corvette)

---

### 4. CROSS-GEN CONTAMINATION (20 records - 0.2%)

**Description:** Inherited sizes from wrong generation showing incorrect diameters

**Examples:**
- 2014 Corvette "Grand Sport" → 15" (should be 18"/19")
- 2014 Corvette "Stingray" → 15" (should be 19"/20")
- 2014 Corvette "Stingray Z51" → 15" (should be 19"/20")

**Root Cause:** These are 2014 C7 Corvettes inheriting from C3/C4 era data

**Remediation:**
```sql
-- Fix 2014 Corvette records with wrong 15" sizes
UPDATE vehicle_fitments 
SET oem_tire_sizes = '["P245/35ZR19", "P285/30ZR20"]'::jsonb,
    source = 'manual_fix_cross_gen'
WHERE make = 'chevrolet' 
  AND model = 'corvette' 
  AND year = 2014
  AND oem_tire_sizes::text LIKE '%R15%';
```

**Recommended Action:**
1. **Fix the 20 cross-gen records immediately** - clear data errors
2. **Add year validation to inheritance scripts** - prevent future contamination

---

## Priority Matrix

| Issue | Records | Risk | Effort | Priority |
|-------|---------|------|--------|----------|
| Cross-Gen Contamination | 20 | HIGH | LOW | 🔴 **P0 - Fix Now** |
| Legacy Contamination | 213 | MEDIUM | MEDIUM | 🟡 **P1 - Review & Fix** |
| Broad Diameter Spread | 299 | LOW | LOW | 🟢 **P2 - Document** |
| Sibling Aggregation | 3,638 | LOW | HIGH | 🟢 **P3 - Future Enhancement** |

---

## Recommended Implementation Order

### Phase 1: Immediate Fixes (P0)
1. Fix 20 cross-gen contamination records (Corvette 2014)
2. Re-run quick validation

### Phase 2: Review & Clean (P1)
1. Review 213 legacy contamination records
2. Identify true errors vs. valid options
3. Fix ~50-100 actual errors
4. Adjust detection heuristics

### Phase 3: Documentation (P2)
1. Document that broad diameter spread is expected for trucks/SUVs
2. Update TOOLS.md with vehicle class expectations

### Phase 4: Future Enhancement (P3)
1. Consider trim-level split for Tier-A vehicles
2. Add trim-aware filtering to API (optional)

---

## Architecture Recommendations

### What Can Be Fixed by Data Cleanup Scripts
- ✅ Cross-gen contamination (20 records)
- ✅ Clear legacy errors (~50-100 records)

### What Needs Generation Inherit Rule Changes
- ⚠️ Add year-based validation to `fill-fitment-gaps.ts`
- ⚠️ Prevent inheriting sizes with diameters < year-appropriate minimum

### What Needs Trim-Level Filtering in API
- 🔄 Optional enhancement for Tier-A vehicles
- 🔄 Not critical - Phase 1 selector handles UX

### What Needs Manual Data Entry/Overrides
- 📝 ~20-50 specific vehicle corrections
- 📝 Tier-A performance vehicle trim splits (future)

---

## Files Generated

| File | Description |
|------|-------------|
| `full-audit-results.json` | Complete audit data (12,333 records) |
| `full-audit-results.csv` | Excel-compatible export |
| `quick-scan-stats.json` | High-level statistics |
| `REMEDIATION-PLAN.md` | This document |

---

## Conclusion

The fitment data is in **good shape overall**:
- 0% missing specs ✅
- 0% implausible diameters ✅
- 66.2% clean records ✅
- Only 0.2% clear cross-gen contamination ⚠️

**Immediate action needed:** Fix 20 cross-gen contamination records.
**Phase 1 wheel diameter selector** remains the correct UX solution for handling multi-diameter vehicles.
