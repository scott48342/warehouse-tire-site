# Tire Fitment Data Remediation Plan

**Generated:** 2026-04-12  
**Audit Source:** `full-audit-results.json`  
**Total Records:** 12,333

---

## Executive Summary

The audit reveals **4,170 records (33.8%)** with actionable issues requiring remediation. The remaining records are either completely safe (762, 6.2%) or have plausible multi-diameter configurations (7,401, 60.0%) which are acceptable for vehicles with multiple OEM wheel options.

### Priority Order (by user impact & risk)
1. 🔴 **Cross-Gen Contamination** - 20 records (0.2%) - **CRITICAL** - Wrong specs inherited
2. 🟠 **Legacy Contamination** - 213 records (1.7%) - **HIGH** - Outdated diameters
3. 🟡 **Broad Diameter Spread** - 299 records (2.4%) - **MEDIUM** - May indicate bad aggregation
4. 🟢 **Sibling Aggregation** - 3,638 records (29.5%) - **LOW** - Acceptable but improvable
5. ⚪ **Missing Specs** - 0 records - **NONE** - Already resolved!

---

## 1. Issue Breakdown Report

### 1.1 Count by Issue Type

| Issue Type | Count | % of Total | Risk Level |
|------------|-------|------------|------------|
| `exact_safe` | 762 | 6.2% | ✅ None |
| `plausible_multi` | 7,401 | 60.0% | ✅ None |
| `sibling_aggregation` | 3,638 | 29.5% | 🟢 Low |
| `broad_diameter_spread` | 299 | 2.4% | 🟡 Medium |
| `legacy_contamination` | 213 | 1.7% | 🟠 High |
| `cross_gen_contamination` | 20 | 0.2% | 🔴 Critical |
| `missing_specs` | 0 | 0.0% | ✅ None |
| `implausible_diameter` | 0 | 0.0% | ✅ None |

### 1.2 Top 10 Affected Makes

| Make | Issue Count | Total Records | % Affected |
|------|-------------|---------------|------------|
| Chevrolet | 366 | 1,048 | 34.9% |
| Ford | 310 | 988 | 31.4% |
| Nissan | 309 | 622 | 49.7% |
| Toyota | 215 | 1,230 | 17.5% |
| GMC | 213 | 631 | 33.8% |
| Subaru | 209 | 315 | 66.3% |
| Lexus | 197 | 204 | 96.6% |
| Kia | 195 | 252 | 77.4% |
| Honda | 162 | 213 | 76.1% |
| Hyundai | 161 | 190 | 84.7% |

**Note:** Lexus, Kia, Honda, Hyundai have high % due to sibling_aggregation (multiple trims grouped) rather than actual data quality issues.

### 1.3 Top 10 Affected Models

| Model | Issue Count | Total Records | % Affected |
|-------|-------------|---------------|------------|
| Chevrolet Silverado-1500 | 107 | 212 | 50.5% |
| Ford F-150 | 104 | 233 | 44.6% |
| GMC Sierra-1500 | 99 | 179 | 55.3% |
| Mazda MX-5 Miata | 73 | 84 | 86.9% |
| Subaru WRX | 55 | 127 | 43.3% |
| Dodge Challenger | 50 | 126 | 39.7% |
| Toyota Tacoma | 46 | 161 | 28.6% |
| Toyota Avalon | 42 | 42 | 100.0% |
| Dodge Charger | 38 | 151 | 25.2% |
| Hyundai Sonata | 33 | 33 | 100.0% |

---

## 2. Issue Examples

### 2.1 Legacy Contamination (213 records)

Records showing outdated/smaller wheel diameters than expected for modern model years.

**Examples:**
| Year | Make | Model | Diameters | Issue |
|------|------|-------|-----------|-------|
| 2026 | BMW | 3-Series | 16, 17, 18, 19 | Min 16" < expected 17" |
| 2026 | Ford | Bronco | 16, 17, 18 | Min 16" < expected 17" |
| 2026 | Ford | Mustang | 17, 18 | Min 17" < expected 18" |
| 2026 | Mazda | MX-5 Miata | 16, 17 | Min 16" < expected 18" |
| 2026 | Subaru | WRX | 17, 18 | Min 17" < expected 18" |

**By Year:**
- 2020-2026: 187 records (88%)
- 2015-2019: 26 records (12%)

**By Source:**
- `generation_inherit`: 63 records
- `generation-baseline`: 50 records
- `generation_import`: 29 records
- `cache-import`: 15 records

### 2.2 Cross-Gen Contamination (20 records)

**ALL 20 records are Chevrolet Corvette (2010-2014)** with inherited 15" diameters from older generations.

| Year | Trim | Current Diameter | Expected |
|------|------|------------------|----------|
| 2014 | Grand Sport | 15" | 18-19" |
| 2014 | Stingray | 15" | 18-19" |
| 2014 | Stingray Z51 | 15" | 18-19" |
| 2014 | Z06 | 15" | 18-20" |
| 2013 | Grand Sport | 15" | 18-19" |
| 2013 | Z06 | 15" | 18-20" |
| 2013 | Z51 | 15" | 18-19" |
| 2013 | ZR1 | 15" | 19-20" |
| 2012 | Grand Sport | 15" | 18-19" |
| 2012 | Z06 | 15" | 18-20" |
| ... | ... | ... | ... |

**Root Cause:** `generation_inherit` rules incorrectly pulled C4/C5 generation specs (1984-2004: 15-17") into C6 generation (2005-2013) and C7 (2014+).

### 2.3 Sibling Aggregation (3,638 records)

Multiple trims grouped together with combined wheel options.

**By Trim Count:**
| Trims Grouped | Records |
|---------------|---------|
| 1 trim | 536 |
| 2 trims | 188 |
| 3 trims | 481 |
| 4 trims | 928 |
| 5 trims | 1,038 |
| 6 trims | 400 |
| 7 trims | 67 |

**Top Models Affected:**
- Toyota Avalon: 42 records
- Dodge Challenger: 40 records
- Hyundai Sonata: 33 records
- Dodge Charger: 30 records
- Cadillac Escalade: 29 records
- Ford Escape: 28 records

**Examples:**
```
2026 Acura MDX
  Trims: Base, Technology, A-Spec, Advance, Type S
  Diameters: 19", 20", 21"

2026 Audi Q5
  Trims: Premium, Premium Plus, Prestige, SQ5, SQ5 Sportback
  Diameters: 18", 19", 20", 21"
```

### 2.4 Broad Diameter Spread (299 records)

**ALL 299 records have a 5" spread.** 100% are trucks/SUVs.

**Affected Models:**
| Model | Records |
|-------|---------|
| Chevrolet Silverado-1500 | 85 |
| Ford F-150 | 68 |
| GMC Sierra-1500 | 62 |
| Toyota Tacoma | 24 |
| Other trucks/SUVs | 60 |

**Example:**
```
2026 Chevrolet Silverado-1500 (Base)
  Diameters: 17", 18", 20", 22"
  Spread: 5"
```

**Sources:**
- `cleanup_generation_template`: 85 records
- `cleanup_wheelsize`: 73 records
- `cleanup_cache-import`: 56 records
- `generation_template`: 40 records

---

## 3. Remediation Plan by Issue Type

### 3.A) Missing Specs ✅ RESOLVED

**Status:** 0 records with missing specs  
**Action:** None needed

---

### 3.B) Legacy Contamination 🟠

**Count:** 213 records (1.7%)  
**Root Cause:** Generation inheritance pulled older spec data into newer model years.

**Remediation Strategy:**

1. **Automated Cleanup Script** (recommended)
   - Target records where `minDiameter < expectedMinForYear`
   - For sports cars (MX-5, WRX, etc.): min 17" for 2020+
   - For sedans/SUVs: min 16" for 2015+, min 17" for 2020+
   - For trucks: keep as-is (legitimate smaller options exist)

2. **Generation Rule Update**
   - Modify `generation_inherit` to NEVER inherit diameters smaller than:
     - 17" for sports cars (2015+)
     - 16" for sedans (2010+)
     - 17" for luxury vehicles (2015+)

3. **Priority Fixes:**
   ```sql
   -- Remove 16" from modern BMW 3-Series (min should be 17")
   UPDATE vehicle_fitments 
   SET tire_sizes = remove_sub_17_sizes(tire_sizes)
   WHERE make = 'bmw' AND model = '3-series' AND year >= 2019;
   
   -- Fix Mazda MX-5 (min should be 16" pre-2019, 17" 2019+)
   -- Fix Subaru WRX (min should be 17" for 2015+, 18" for STI)
   ```

**Recommendation:** Cleanup script + updated generation rules

---

### 3.C) Cross-Gen Contamination 🔴 CRITICAL

**Count:** 20 records (0.2%)  
**Root Cause:** All are Chevrolet Corvette 2010-2014 inheriting 15" from older gens.

**Remediation Strategy:**

1. **Immediate Manual Fix** (one-time)
   ```javascript
   // Fix Corvette C6 (2005-2013)
   const c6Specs = {
     'Base': { diameters: [18, 19] },
     'Z51': { diameters: [18, 19] },
     'Grand Sport': { diameters: [18, 19] },
     'Z06': { diameters: [18, 19, 20] },
     'ZR1': { diameters: [19, 20] }
   };
   
   // Fix Corvette C7 (2014-2019)
   const c7Specs = {
     'Stingray': { diameters: [18, 19, 20] },
     'Stingray Z51': { diameters: [19, 20] },
     'Grand Sport': { diameters: [19, 20] },
     'Z06': { diameters: [19, 20] }
   };
   ```

2. **Generation Rule Tightening**
   - Add generation boundary checks to `generation_inherit`
   - Corvette generations: C4 (1984-1996), C5 (1997-2004), C6 (2005-2013), C7 (2014-2019), C8 (2020+)
   - NEVER inherit across major generation boundaries for sports cars

3. **Validation Rule**
   - Any vehicle with min diameter <16" should be flagged for 2000+ year
   - Any sports car with min diameter <17" should be flagged for 2010+

**Recommendation:** Manual fix NOW (20 records), then rule update

---

### 3.D) Sibling Aggregation 🟢

**Count:** 3,638 records (29.5%)  
**Nature:** Multiple trims grouped together with combined tire sizes.

**Is This a Problem?**
- **For tire search:** ✅ OK - Shows all valid sizes for the vehicle
- **For wheel search:** ⚠️ Suboptimal - May show wrong bolt patterns for specific trims
- **For user experience:** ⚠️ Suboptimal - Can't narrow down to exact trim

**Remediation Options:**

1. **Option A: Keep Grouped (Recommended for now)**
   - Pros: Already working, covers all valid sizes
   - Cons: Less precise
   - Action: Add UI hint "Multiple trims - verify with your specific vehicle"

2. **Option B: Split by Trim**
   - Pros: More accurate recommendations
   - Cons: Massive data entry effort, 3,638+ records to split
   - Action: Only for Tier A performance vehicles

3. **Option C: Hybrid Approach**
   - Split: Performance trims with different specs (Type S, RS, SS, etc.)
   - Keep grouped: Standard trims with same specs
   - Priority: Challenger, Charger, Mustang, Camaro, WRX, M-cars, AMG

**Recommendation:** Keep grouped + UI hint + selective split for Tier A

---

### 3.E) Broad Diameter Spread 🟡

**Count:** 299 records (2.4%)  
**All have 5" spread.** All are trucks/SUVs.

**Is This Legitimate?**
- **YES** for full-size trucks: Silverado/F-150/Sierra legitimately offer 17" (work truck) through 22" (high trim)
- **MAYBE** for some records if aggregation was too aggressive

**Remediation Strategy:**

1. **Validate Truck Spreads**
   - 5" spread is NORMAL for: Silverado, F-150, Sierra, RAM 1500, Tacoma, Tundra
   - Create vehicle class rules:
     ```javascript
     const maxSpreadByClass = {
       'full-size-truck': 5,  // 17" to 22" is valid
       'mid-size-truck': 4,   // 16" to 20" typical
       'suv-full': 4,         // 18" to 22" typical
       'suv-mid': 3,          // 17" to 20" typical
       'sedan': 2,            // 16" to 18" typical
       'sports': 2            // 18" to 20" typical
     };
     ```

2. **Review Non-Truck Spreads**
   - Any sedan/sports car with 5" spread = bad data
   - Query: `issueType = 'broad_diameter_spread' AND isTruckSuv = false`
   - (Results show 0 - all 299 are trucks ✅)

3. **Source Cleanup**
   - `cleanup_*` sources account for 214/299 (72%)
   - Review cleanup scripts that may be over-aggregating

**Recommendation:** Accept as-is for trucks + add validation rules for non-trucks

---

## 4. Architecture Recommendations

### 4.1 What Can Be Fixed by Data Cleanup Scripts

| Issue | Script Action | Est. Records |
|-------|---------------|--------------|
| Cross-Gen Contamination | Delete/replace Corvette 2010-2014 records | 20 |
| Legacy Contamination | Remove sub-17" diameters for modern sports cars | ~100 |
| Legacy Contamination | Remove sub-16" diameters for modern sedans | ~50 |

**Script: `fix-legacy-diameters.ts`**
```typescript
// Remove outdated small diameters from modern vehicles
const fixes = [
  { where: { make: 'mazda', model: 'mx-5-miata', year: { gte: 2019 } }, 
    action: 'remove_diameters_below', value: 16 },
  { where: { make: 'subaru', model: 'wrx', year: { gte: 2015 } },
    action: 'remove_diameters_below', value: 17 },
  { where: { make: 'bmw', model: '3-series', year: { gte: 2019 } },
    action: 'remove_diameters_below', value: 17 },
];
```

### 4.2 What Needs Generation Inherit Rule Changes

| Change | Impact |
|--------|--------|
| Add generation boundary definitions | Prevents cross-gen inheritance |
| Add minimum diameter floor by vehicle class | Prevents legacy contamination |
| Add sports car flag for stricter rules | Better handling of performance vehicles |

**Update: `generation-rules.ts`**
```typescript
const generationBoundaries = {
  'chevrolet/corvette': [
    { gen: 'C4', years: [1984, 1996], minDia: 16 },
    { gen: 'C5', years: [1997, 2004], minDia: 17 },
    { gen: 'C6', years: [2005, 2013], minDia: 18 },
    { gen: 'C7', years: [2014, 2019], minDia: 18 },
    { gen: 'C8', years: [2020, 2030], minDia: 19 },
  ],
  // ... other vehicles
};
```

### 4.3 What Needs Trim-Level Filtering in the API

| Feature | Benefit |
|---------|---------|
| Trim selector in search | Allows narrowing to specific trim |
| Performance trim detection | Auto-detect Type S, SS, RS, M, AMG |
| Staggered setup flag | Already implemented ✅ |

**No immediate changes needed** - current aggregation works for tire recommendations.

### 4.4 What Needs Manual Data Entry/Overrides

| Item | Priority | Records |
|------|----------|---------|
| Corvette C6/C7 specs | 🔴 Critical | 20 |
| Tier A performance splits | 🟡 Medium | ~50 |
| MX-5 Miata modern specs | 🟡 Medium | ~60 |

---

## 5. Priority Ranking

### 5.1 By User Impact

| Rank | Issue | Est. Users Affected | Why |
|------|-------|---------------------|-----|
| 1 | Cross-Gen Contamination | Medium (Corvette owners) | Completely wrong specs |
| 2 | Legacy Contamination | Low-Medium | May see outdated tire sizes |
| 3 | Broad Diameter Spread | Low | Trucks users expect variety |
| 4 | Sibling Aggregation | Very Low | Still shows valid sizes |

### 5.2 By Risk of Wrong Recommendations

| Rank | Issue | Risk Level | Consequence |
|------|-------|------------|-------------|
| 1 | Cross-Gen Contamination | 🔴 CRITICAL | Shows 15" tires for 18"+ wheels |
| 2 | Legacy Contamination | 🟠 HIGH | Shows smaller sizes that may not fit |
| 3 | Broad Diameter Spread | 🟡 MEDIUM | Too many options, user confusion |
| 4 | Sibling Aggregation | 🟢 LOW | Shows superset of valid options |

---

## 6. Recommended Action Plan

### Phase 1: Immediate (Week 1)
- [ ] Manual fix: Corvette 2010-2014 specs (20 records)
- [ ] Add generation boundary rules for Corvette

### Phase 2: Short-term (Weeks 2-3)
- [ ] Cleanup script: Remove legacy contamination from MX-5, WRX, BMW 3-Series
- [ ] Update generation_inherit minimum diameter floors
- [ ] Review cleanup_* sources for over-aggregation

### Phase 3: Medium-term (Weeks 4-6)
- [ ] Add vehicle class validation rules
- [ ] UI: Add "verify with your specific trim" hint for aggregated records
- [ ] Consider Tier A trim splitting for Challenger/Charger/Mustang

### Phase 4: Ongoing
- [ ] Monitor audit results after each data import
- [ ] Quarterly review of generation rules
- [ ] User feedback integration for spec corrections

---

## Appendix: Source Quality Analysis

| Source | Total | Issues | % Issues | Assessment |
|--------|-------|--------|----------|------------|
| merge_consolidation | 119 | 0 | 0% | ✅ Excellent |
| manual_backfill | 110 | 0 | 0% | ✅ Excellent |
| platform_inheritance_ld | 29 | 0 | 0% | ✅ Excellent |
| manual_fix | 8 | 0 | 0% | ✅ Excellent |
| manual_import | 79 | 0 | 0% | ✅ Excellent |
| tier-a-import | 412 | 47 | 11% | ✅ Good |
| generation-baseline | 1,398 | 151 | 11% | ✅ Good |
| railway_import | 336 | 51 | 15% | 🟡 Moderate |
| cache-import | 2,140 | 1,545 | 72% | 🟠 Needs review |
| batch7-subcompacts-final | 158 | 154 | 97% | 🔴 High issue rate |
| luxury-gap-fill | 226 | 224 | 99% | 🔴 High issue rate |

**Note:** High issue rates in batch7/luxury-gap-fill are largely sibling_aggregation, not data quality problems.

---

*End of Remediation Plan*
