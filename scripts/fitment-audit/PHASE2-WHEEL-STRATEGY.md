# Phase 2 Wheel Coverage Strategy

**Date:** 2026-04-12  
**Total Missing:** 1,452 records  
**Legacy (2000-2014):** 739 | **Modern (2015-2026):** 713

---

## Root Cause Analysis

### 🔴 HD Trucks — 764 records (53%)
The single biggest issue. Heavy-duty trucks are missing because:
- Complex wheel configurations (dually vs SRW)
- Multiple axle configurations
- No donor data in current database

**Affected Models:**
| Model | Count |
|-------|-------|
| gmc/sierra-2500hd | 109 |
| gmc/sierra-3500hd | 109 |
| chevrolet/silverado-2500hd | 107 |
| chevrolet/silverado-3500hd | 107 |
| ram/2500 | 106 |
| ram/3500 | 90 |

### 🟡 Naming Inconsistencies — ~556 records (38%)
Model slug variations are fragmenting data:

| Variant A | Variant B | Records |
|-----------|-----------|---------|
| silverado-2500-hd | silverado-2500hd | 149 |
| sierra-2500hd | sierra-2500-hd | 149 |
| sierra-3500hd | sierra-3500-hd | 130 |
| silverado-3500hd | silverado-3500-hd | 128 |

**Impact:** Records with one slug can't find donors with the other slug.

### 🟢 Light Trucks — 159 records
Standard pickups/SUVs that likely have donor data:

| Model | Count |
|-------|-------|
| chevrolet/silverado-1500 | 27 |
| gmc/sierra-1500 | 27 |
| gmc/yukon-xl | 27 |
| gmc/yukon | 26 |
| chevrolet/suburban | 22 |
| chevrolet/tahoe | 21 |

### ⚪ Discontinued Brands — 113 records (8%)
Low priority / no commercial relevance:

| Make | Count |
|------|-------|
| Pontiac | 40 |
| Saturn | 31 |
| Hummer | 19 |
| Oldsmobile | 13 |
| Geo | 10 |

---

## Classification Buckets

| Bucket | Count | Action | Priority |
|--------|-------|--------|----------|
| **HD Trucks** | 764 | Import OEM templates | 🔴 High (but complex) |
| **Naming Issues** | 556 | Consolidate slugs | 🔴 High (prerequisite) |
| **Light Trucks** | 159 | Expand generations + fill | 🟢 Safe |
| **Discontinued** | 113 | Defer | ⚪ Low |
| **Performance** | 18 | Check donors | 🟢 Safe |
| **Luxury** | 57 | Check donors | 🟡 Medium |

---

## Recommended Implementation Order

### Step 1: Fix Naming Inconsistencies (PREREQUISITE)
**Before any filling**, consolidate model slugs:

```sql
-- Example: Merge silverado-2500-hd → silverado-2500hd
UPDATE vehicle_fitments
SET model = 'silverado-2500hd'
WHERE model = 'silverado-2500-hd';
```

This may:
- Reveal hidden donors (records with different slug but same platform)
- Reduce total missing count significantly
- Enable safe inheritance for HD trucks

**Affected slugs:**
- `silverado-2500-hd` → `silverado-2500hd`
- `silverado-3500-hd` → `silverado-3500hd`
- `sierra-2500-hd` → `sierra-2500hd`
- `sierra-3500-hd` → `sierra-3500hd`

### Step 2: Fill Light Trucks (SAFE)
After naming fix, run fill for:
- Silverado 1500, Sierra 1500
- Tahoe, Suburban, Yukon, Yukon XL
- Add generation definitions to fill script

**Expected fill:** 100-150 records

### Step 3: HD Truck Assessment
After Steps 1-2, re-evaluate HD trucks:
- Some may now have donors (from slug consolidation)
- Remaining truly missing → need OEM template import

**DO NOT auto-fill HD trucks without:**
- Verified SRW vs DRW distinction
- Correct bolt pattern (8x165.1 vs 8x180)
- Proper center bore (116mm vs 121mm)

### Step 4: Performance & Luxury
Check remaining gaps:
- Corvette, Camaro, Mustang — likely have donors
- Cadillac, Lincoln — check generation coverage

### Step 5: Defer Discontinued Brands
- Pontiac, Saturn, Oldsmobile, Hummer, Geo
- No commercial value
- Can fill opportunistically if donors exist

---

## DO NOT

❌ Auto-fill HD trucks without dually/SRW verification  
❌ Cross-generation inheritance (especially pre-2015 → post-2015)  
❌ Weaken existing validation rules  
❌ Overwrite existing valid wheel specs  
❌ Fill records with naming inconsistencies (fix names first)

---

## Expected Outcomes

| Step | Records Fixed | Remaining |
|------|---------------|-----------|
| Start | 0 | 1,452 |
| Step 1 (naming) | ~200 (revealed donors) | ~1,250 |
| Step 2 (light trucks) | ~150 | ~1,100 |
| Step 3 (HD assessment) | ~200-400 | ~700-900 |
| Step 4 (perf/luxury) | ~50 | ~650-850 |
| Step 5 (defer) | 113 (deferred) | ~537-737 |

**Realistic Phase 2 target:** Reduce missing from 1,452 → ~600-800  
**Full resolution:** Would require HD truck OEM data import (~400-600 records)

---

## Files Created

| File | Purpose |
|------|---------|
| `classify-missing-wheels.js` | Classification script |
| `missing-wheel-classification.json` | Full classification data |
| `PHASE2-WHEEL-STRATEGY.md` | This document |

---

*Next action: Run naming consolidation script (Step 1)*
