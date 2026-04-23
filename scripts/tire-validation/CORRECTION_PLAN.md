# Tire Data Correction Plan

**Generated:** 2026-04-22  
**Source:** 137 batch validation files  
**Total Vehicles Processed:** 9,026

## Executive Summary

The tire validation QA process identified **12,004 issues** across the vehicle fitment database. This document outlines the correction strategy and prioritizes fixes by impact.

### Issue Breakdown

| Category | Count | Priority | Action |
|----------|-------|----------|--------|
| Invalid Year Entries | 44 | 🔴 HIGH | DELETE |
| Non-US Market Vehicles | 261 | 🟡 MEDIUM | DELETE or MARK |
| Wrong Tire Sizes | 560 | 🔴 HIGH | UPDATE |
| Missing Data | 9,412 | 🟠 VARIABLE | INSERT/IGNORE |
| Missing Rear Sizes (Staggered) | 1,673 | 🟡 MEDIUM | INSERT |
| Duplicate Models (Should be Trims) | 54 | 🟢 LOW | MERGE |
| Warnings/Review Needed | 211 | ⚪ LOW | MANUAL REVIEW |

---

## 1. DELETES - Invalid Year Entries (44 records)

These vehicles either didn't exist in the specified years or are pre-production/concept entries that shouldn't be in production data.

### High Priority Deletes

| Make | Model | Years to Delete | Reason |
|------|-------|-----------------|--------|
| Nissan | 350Z | 2002 | Production started 2003 |
| Nissan | 370Z | 2021-2023 | Production ended 2020 |
| Nissan | Z | 2003-2022 | New Z production started 2023 |
| Jeep | Cherokee | 2024-2026 | Discontinued after 2023 |
| Buick | Royaum | ALL | Invalid model name (typo) |
| Cadillac | CT5 | 2019 | Production started 2020 |
| Cadillac | CTS | 2002 | Production started 2003 |
| Infiniti | Q50 | 2013 | Production started 2014 |
| Infiniti | QX55 | 2021 | Production started 2022 |
| GMC | Terrain | 2008-2009 | Production started 2010 |
| Kia | Telluride | 2019 | Production started 2020 |
| Lincoln | Aviator | 2019 | Production started 2020 |

**Estimated Impact:** Removes 44 invalid database entries that would show incorrect fitment data.

---

## 2. DELETES - Non-US Market Vehicles (261 records)

Vehicles sold only in Japan (JDM), China, Europe, or other markets. Not relevant for US tire retailers.

### By Region

| Market | Count | Examples |
|--------|-------|----------|
| JDM (Japan) | ~120 | Toyota Alphard, Nissan Silvia, Honda Stepwgn |
| China-only | ~40 | Audi A7L, various long-wheelbase variants |
| Europe-only | ~60 | VW Polo, Audi A1, Renault/Peugeot/Citroen |
| Other | ~40 | Holden (Australia), SEAT, Skoda |

### Decision Required

**Option A:** DELETE all non-US market vehicles  
**Option B:** Add `market` column and mark as `non-us` (keeps data for potential future use)

**Recommendation:** Option B - Add market flag. Some customers import JDM vehicles.

---

## 3. UPDATES - Wrong Tire Sizes (560 records)

These entries have incorrect tire size data that needs correction. Issues include:
- Aftermarket sizes mixed with OEM sizes
- Wrong generation sizes applied to wrong years
- Typos in tire size specifications

### Sample Corrections Needed

| Make | Model | Year | Current Issue | Correct Size |
|------|-------|------|---------------|--------------|
| Acura | ADX | 2025-2026 | Has truck sizes (285/75R16) | 225/55R18, 235/45R19 |
| Various | Various | Various | Aftermarket sizes in OEM data | Remove aftermarket |

**Full list:** See `consolidated-issues.json` → `issues.updates.wrongTireSizes`

---

## 4. INSERTS - Missing Data (9,412 records)

Many entries lack tire size data. These fall into categories:

### Category Breakdown

| Sub-Category | Estimated Count | Action |
|--------------|-----------------|--------|
| Empty entries (no data at all) | ~3,000 | Research & populate |
| Missing tire sizes (have wheel data) | ~4,000 | Research tire sizes |
| Low confidence data | ~2,400 | Verify & update |

### Priority Approach

1. **Tier A Vehicles First:** Focus on popular makes (Ford, Chevrolet, Toyota, Honda)
2. **Recent Years:** Prioritize 2020-2026 model years
3. **High-traffic Models:** F-150, Silverado, Camry, Accord, etc.

---

## 5. INSERTS - Missing Rear Sizes (1,673 records)

Staggered vehicles (different front/rear tire sizes) that only have front tire data.

### Affected Vehicle Types

- Sports cars (Mustang, Camaro, Challenger, 370Z, etc.)
- Luxury performance (BMW M-series, Mercedes AMG)
- Exotic/supercar (Corvette, various)

**Action:** Research and add rear tire specifications.

---

## 6. MERGES - Duplicate Models (54 records)

Models that should be trims of their parent model.

| Make | Current Model | Should Be Trim Of |
|------|---------------|-------------------|
| Subaru | Impreza Sport | Impreza |
| Subaru | Impreza Premium | Impreza |
| Honda | Civic Si | Civic |
| Honda | Civic Type R | Civic |
| Honda | Accord Sport | Accord |
| VW | GTI | Golf |
| VW | Golf R | Golf |

**Decision Required:** Some of these (like Civic Type R, GTI) are marketed as distinct models. May want to keep separate for customer findability.

---

## Implementation Plan

### Phase 1: Critical Deletes (Immediate)
- [ ] Delete invalid year entries (44 records)
- [ ] Delete or flag non-US market vehicles (261 records)

### Phase 2: Data Corrections (Week 1)
- [ ] Fix wrong tire sizes (560 records)
- [ ] Add missing rear sizes for staggered (1,673 records)

### Phase 3: Data Population (Ongoing)
- [ ] Populate missing data for Tier A vehicles
- [ ] Verify and update low-confidence entries

### Phase 4: Model Cleanup (After Review)
- [ ] Decide on model merge strategy
- [ ] Execute merges if approved

---

## Files Generated

| File | Description |
|------|-------------|
| `consolidated-issues.json` | All issues in JSON format |
| `apply-corrections.mjs` | Migration script for database corrections |
| `CORRECTION_PLAN.md` | This document |

---

## Running the Migration

```bash
# Preview changes (dry run)
node apply-corrections.mjs --dry-run

# Apply changes
node apply-corrections.mjs

# Apply specific category only
node apply-corrections.mjs --category=deletes
node apply-corrections.mjs --category=updates
```

---

## Notes

1. **Backup First:** Always backup the database before running migrations
2. **Incremental:** Run migrations in batches, not all at once
3. **Verify:** Spot-check results after each migration phase
4. **Log Everything:** Keep audit trail of all changes

**Contact:** Questions about specific corrections should be reviewed before applying.
