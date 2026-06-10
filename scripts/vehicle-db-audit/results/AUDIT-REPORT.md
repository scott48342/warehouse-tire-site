# Vehicle Fitment Database Audit Report

**Generated:** 2026-06-10T13:16:59.696Z

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Records (2000+) | 31,309 |
| Unique Makes | 98 |
| Unique Models | 1419 |
| 2018 Excess Records | 1,144 |
| Case-Duplicate Makes | 17 |
| Lowercase Make Records | 176 |
| Duplicate YMMT Groups | 951 |
| Missing Wheel Fields | 68 |

## Issues Found

### 1. 2018 Year Spike 🚨
- Expected records: ~1,336
- Actual records: 2,480
- Excess: 1,144 (86% above expected)
- **Likely cause:** Import artifact / duplicate batch

### 2. Make Normalization
- "jeep" (51) should merge into "Jeep" (979)
- "Ram" (37) should merge into "RAM" (886)
- "chevrolet" (28) should merge into "Chevrolet" (2232)
- "Mini" (19) should merge into "MINI" (344)
- "ford" (17) should merge into "Ford" (2018)
- "land rover" (15) should merge into "Land Rover" (591)
- "cadillac" (12) should merge into "Cadillac" (564)
- "tesla" (10) should merge into "Tesla" (124)
- "audi" (8) should merge into "Audi" (991)
- "porsche" (8) should merge into "Porsche" (845)
- "volkswagen" (6) should merge into "Volkswagen" (807)
- "rivian" (6) should merge into "Rivian" (11)
- "lincoln" (5) should merge into "Lincoln" (465)
- "bmw" (5) should merge into "BMW" (1602)
- "kia" (5) should merge into "Kia" (756)
- "hyundai" (4) should merge into "Hyundai" (760)
- "dodge" (1) should merge into "Dodge" (600)

### 3. Phantom Makes
- "Toyota Minivans": 13 records (should be re-homed or deleted)
- "Nissan Vans": 11 records (should be re-homed or deleted)
- "Ford Vans": 10 records (should be re-homed or deleted)
- "Ford Minivans": 9 records (should be re-homed or deleted)
- "Chrysler Minivans": 9 records (should be re-homed or deleted)
- "Mercedes-Benz Vans": 7 records (should be re-homed or deleted)
- "RAM Minivans": 6 records (should be re-homed or deleted)
- "GMC Vans": 6 records (should be re-homed or deleted)
- "Chevrolet Vans": 6 records (should be re-homed or deleted)
- "Kia Minivans": 5 records (should be re-homed or deleted)
- "Honda Minivans": 5 records (should be re-homed or deleted)
- "RAM Vans": 5 records (should be re-homed or deleted)
- "Dodge Minivans": 4 records (should be re-homed or deleted)
- "Nissan Minivans": 3 records (should be re-homed or deleted)
- "Mercedes-Benz Minivans": 2 records (should be re-homed or deleted)
- "Chevrolet Minivans": 2 records (should be re-homed or deleted)

### 4. Missing Critical Fields
- Missing bolt pattern: 30
- Missing center bore: 64
- **Impact:** These records cannot safely be used for wheel fitment

## Correlation Analysis

The following flags often appear together, suggesting a single rogue import batch:
- [clean]: 28,611 records
- [2018, unknown-tier]: 2,480 records
- [unknown-tier, lowercase]: 147 records
- [unknown-tier]: 37 records
- [lowercase]: 34 records

## Proposed Migration Steps


### Step 1: MAKE_CANONICALIZATION
Merge case-duplicate makes into canonical form
- Merge "jeep" into "Jeep" (~51 rows)
- Merge "Ram" into "RAM" (~37 rows)
- Merge "chevrolet" into "Chevrolet" (~28 rows)
- Merge "Mini" into "MINI" (~19 rows)
- Merge "ford" into "Ford" (~17 rows)
- Merge "land rover" into "Land Rover" (~15 rows)
- Merge "cadillac" into "Cadillac" (~12 rows)
- Merge "tesla" into "Tesla" (~10 rows)
- Merge "audi" into "Audi" (~8 rows)
- Merge "porsche" into "Porsche" (~8 rows)
- Merge "volkswagen" into "Volkswagen" (~6 rows)
- Merge "rivian" into "Rivian" (~6 rows)
- Merge "lincoln" into "Lincoln" (~5 rows)
- Merge "bmw" into "BMW" (~5 rows)
- Merge "kia" into "Kia" (~5 rows)
- Merge "hyundai" into "Hyundai" (~4 rows)
- Merge "dodge" into "Dodge" (~1 rows)


### Step 2: DELETE_PHANTOM_MAKES
Re-home or delete records with phantom makes (Toyota Minivans, Nissan Vans)
- Review and re-home "Toyota Minivans" records (~13 rows)
- Review and re-home "Nissan Vans" records (~11 rows)
- Review and re-home "Ford Vans" records (~10 rows)
- Review and re-home "Ford Minivans" records (~9 rows)
- Review and re-home "Chrysler Minivans" records (~9 rows)
- Review and re-home "Mercedes-Benz Vans" records (~7 rows)
- Review and re-home "RAM Minivans" records (~6 rows)
- Review and re-home "GMC Vans" records (~6 rows)
- Review and re-home "Chevrolet Vans" records (~6 rows)
- Review and re-home "Kia Minivans" records (~5 rows)
- Review and re-home "Honda Minivans" records (~5 rows)
- Review and re-home "RAM Vans" records (~5 rows)
- Review and re-home "Dodge Minivans" records (~4 rows)
- Review and re-home "Nissan Minivans" records (~3 rows)
- Review and re-home "Mercedes-Benz Minivans" records (~2 rows)
- Review and re-home "Chevrolet Minivans" records (~2 rows)


### Step 3: DEDUPLICATE_2018
Remove duplicate YMMT records, keeping highest quality
- Deduplicate by YMMT, keeping best quality_tier (~1144 rows)


### Step 4: BACKFILL_OR_QUARANTINE_MISSING_FIELDS
Quarantine records missing bolt_pattern or center_bore_mm
- Mark records with missing wheel fields (~68 rows)


## Integrity Checks (For Future Imports)

- **no_lowercase_makes**: Reject imports with lowercase makes
- **no_phantom_makes**: Reject imports with phantom makes (Toyota Minivans, etc.)
- **no_missing_wheel_fields**: Warn if records missing bolt_pattern or center_bore_mm
- **no_year_spikes**: Alert if any year has >1.5x records of neighboring years
- **no_duplicate_ymmt**: Reject imports that create YMMT duplicates

---

**⚠️ NO DATA HAS BEEN MODIFIED. Review this report and approve before running migrations.**
