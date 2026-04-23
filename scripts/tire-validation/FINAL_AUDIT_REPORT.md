# 🔍 Vehicle Fitment Database - FINAL AUDIT REPORT

**Generated:** 4/21/2026, 8:22:33 PM  
**Database:** Prisma Postgres (Neon)  
**Table:** vehicle_fitments

---

## 📊 Executive Summary

### Overall Health Score: 81/100 (Grade: B)

| Category | Score | Max |
|----------|-------|-----|
| Coverage | 20 | 30 |
| Wheel Specs | 24 | 25 |
| Tire Specs | 22 | 25 |
| Data Quality | 15 | 20 |

### Quick Stats
- **Total Records:** 18,546
- **Unique Makes:** 61
- **Unique Models:** 904
- **Year Range:** 1953 - 2026

---

## 📈 YMM Coverage Analysis (2000-2026)

### Coverage by Make

| Make | Models | Records | Years Covered (/27) |
|------|--------|---------|---------------------|
| Mercedes | 72 | 1,533 | 27 |
| Toyota | 53 | 1,460 | 27 |
| Chevrolet | 73 | 1,348 | 27 |
| Ford | 49 | 1,242 | 27 |
| BMW | 36 | 1,013 | 27 |
| Nissan | 47 | 736 | 27 |
| Audi | 43 | 728 | 27 |
| Ram | 8 | 692 | 27 |
| GMC | 23 | 662 | 27 |
| Mazda | 27 | 638 | 27 |
| Dodge | 25 | 567 | 27 |
| Jeep | 10 | 487 | 27 |
| Subaru | 20 | 397 | 27 |
| Chrysler | 17 | 373 | 27 |
| Honda | 20 | 274 | 27 |
| Lexus | 17 | 261 | 27 |
| Volkswagen | 24 | 252 | 27 |
| Kia | 17 | 241 | 27 |
| Hyundai | 20 | 227 | 27 |
| Buick | 26 | 221 | 27 |
| Cadillac | 29 | 217 | 27 |
| Land Rover | 16 | 202 | 27 |
| Mitsubishi | 21 | 181 | 27 |
| Volvo | 18 | 176 | 27 |
| Infiniti | 15 | 170 | 27 |
| Acura | 15 | 154 | 27 |
| Lincoln | 16 | 151 | 27 |
| Porsche | 9 | 138 | 27 |
| Jaguar | 10 | 129 | 26 |
| Tesla | 6 | 119 | 21 |
| Mini | 5 | 85 | 25 |
| Genesis | 5 | 39 | 10 |

### ⚠️ Models Missing Recent Years (2024-2026)

These models have 2023 data but are missing 2024-2026:

| Make | Model | Last Year | Missing Years |
|------|-------|-----------|---------------|
| Acura | nsx | 2023 | 2024, 2025, 2026 |
| Acura | zdx | 2025 | 2026 |
| Audi | e-tron | 2023 | 2024, 2025, 2026 |
| Audi | e-tron-s | 2023 | 2024, 2025, 2026 |
| Audi | q2l-e-tron | 2023 | 2024, 2025, 2026 |
| Audi | q5-e-tron | 2024 | 2025, 2026 |
| Audi | q6 | 2025 | 2026 |
| Audi | q8-e-tron | 2025 | 2026 |
| Audi | q8-sportback-e-tron | 2025 | 2026 |
| Audi | r8 | 2023 | 2024, 2025, 2026 |
| Audi | rs5 | 2025 | 2026 |
| Audi | s6 | 2025 | 2026 |
| Audi | sq8-sportback-e-tron | 2025 | 2026 |
| Audi | tt | 2023 | 2024, 2025, 2026 |
| Audi | tt-rs | 2023 | 2024, 2025, 2026 |
| Audi | tt-s | 2023 | 2024, 2025, 2026 |
| BMW | x3-m | 2024 | 2025, 2026 |
| Buick | electra-e4 | 2025 | 2026 |
| Buick | electra-e4-gs | 2025 | 2026 |
| Buick | envision-s-gs | 2024 | 2025, 2026 |
| Buick | envista-gs | 2025 | 2026 |
| Buick | regal-gs | 2023 | 2024, 2025, 2026 |
| Buick | verano-pro-gs | 2025 | 2026 |
| Cadillac | ct6 | 2025 | 2026 |
| Cadillac | xt4 | 2025 | 2026 |
| Cadillac | xt6 | 2025 | 2026 |
| Chevrolet | bolt-euv | 2025 | 2026 |
| Chevrolet | bolt-ev | 2025 | 2026 |
| Chevrolet | camaro | 2024 | 2025, 2026 |
| Chevrolet | cruze-sport6-rs | 2024 | 2025, 2026 |
| Chevrolet | spark | 2023 | 2024, 2025, 2026 |
| Chevrolet | tracker-rs | 2025 | 2026 |
| Dodge | challenger | 2024 | 2025, 2026 |
| Dodge | charger-pursuit | 2024 | 2025, 2026 |
| Ford | fiesta | 2024 | 2025, 2026 |
| Ford | focus | 2025 | 2026 |
| Ford | mustang-mach-1 | 2023 | 2024, 2025, 2026 |
| Ford | mustang-shelby-gt500 | 2023 | 2024, 2025, 2026 |
| Ford | taurus | 2025 | 2026 |
| Ford | transit | 2025 | 2026 |
| Ford | transit-t8 | 2025 | 2026 |
| GMC | hummer-ev-suv | 2024 | 2025, 2026 |
| GMC | sierra-2500-hd | 2025 | 2026 |
| GMC | sierra-3500-hd | 2025 | 2026 |
| GMC | yukon-xl | 2024 | 2025, 2026 |
| Hyundai | ioniq | 2023 | 2024, 2025, 2026 |
| Infiniti | q60 | 2023 | 2024, 2025, 2026 |
| Infiniti | qx55 | 2025 | 2026 |
| Jaguar | e-pace | 2025 | 2026 |
| Jaguar | f-pace | 2025 | 2026 |

*...and 48 more*

### 🕳️ Year Gaps in Model Coverage

| Make | Model | Gap Start | Gap End | Missing Years |
|------|-------|-----------|---------|---------------|
| Acura | nsx | 2005 | 2016 | 10 |
| Acura | zdx | 2013 | 2023 | 9 |
| Audi | allroad | 2005 | 2013 | 7 |
| Audi | rs6 | 2003 | 2020 | 16 |
| Audi | s6 | 2003 | 2006 | 2 |
| Audi | s8 | 2003 | 2006 | 2 |
| Audi | tt-rs | 2014 | 2016 | 1 |
| BMW | m2 | 2021 | 2023 | 1 |
| BMW | m6 | 2010 | 2012 | 1 |
| Cadillac | cts-v | 2007 | 2009 | 1 |
| Chevrolet | blazer | 2011 | 2019 | 7 |
| Chevrolet | camaro | 2002 | 2010 | 7 |
| Chevrolet | silverado-1500-hd | 2003 | 2005 | 1 |
| Chevrolet | trailblazer | 2009 | 2013 | 3 |
| Chrysler | pacifica | 2008 | 2016 | 7 |
| Chrysler | voyager | 2016 | 2020 | 3 |
| Dodge | viper | 2006 | 2008 | 1 |
| Dodge | viper | 2010 | 2013 | 2 |
| Ford | explorer-sport-trac | 2005 | 2007 | 1 |
| Ford | fiesta-ikon | 2007 | 2011 | 3 |
| Ford | gt | 2006 | 2017 | 10 |
| Ford | maverick | 2007 | 2021 | 13 |
| Ford | mustang-cobra | 2001 | 2003 | 1 |
| Ford | mustang-mach-1 | 2004 | 2019 | 14 |
| Ford | mustang-shelby-gt350 | 2013 | 2016 | 2 |
| Ford | mustang-shelby-gt500 | 2014 | 2020 | 5 |
| GMC | canyon | 2012 | 2015 | 2 |
| GMC | sierra-1500-limited | 2019 | 2022 | 2 |
| Honda | insight | 2006 | 2009 | 2 |
| Honda | insight | 2014 | 2018 | 3 |

*...and 21 more gaps*

---

## 🔧 Wheel Spec Completeness

| Field | Records | Percentage |
|-------|---------|------------|
| bolt_pattern | 18,546 | 100.00% |
| center_bore_mm | 18,546 | 100.00% |
| thread_size | 18,497 | 99.74% |
| offset_min_mm | 18,506 | 99.78% |
| offset_max_mm | 18,506 | 99.78% |
| oem_wheel_sizes (non-empty) | 16,967 | 91.49% |

---

## 🛞 Tire Spec Completeness

| Metric | Count | Percentage |
|--------|-------|------------|
| oem_tire_sizes (non-empty) | 16,360 | 88.21% |
| **Records with wheels but NO tires** | 749 | 4.04% |

### Sample Records with Wheels but No Tires

| Year | Make | Model | Trim | Wheel Sizes |
|------|------|-------|------|-------------|
| 2026 | audi | s8l | Base | 20", 21" |
| 2026 | audi | sq5 | Base | 20", 21" |
| 2026 | audi | sq6-e-tron | Base | 20", 21" |
| 2026 | audi | sq7 | Base | 21", 22" |
| 2026 | audi | sq8 | Base | 22", 23" |
| 2026 | bmw | 2-series | Base | 17", 18", 19" |
| 2026 | bmw | 4-series-gran-coupe | Base | 17", 18", 19" |
| 2026 | bmw | 8-series | Base | 19", 20", 21" |
| 2026 | bmw | i4 | Base | 18", 19", 20" |
| 2026 | bmw | i5 | Base | 18", 19", 20", 21" |
| 2026 | bmw | i7 | Base | 20", 21", 22" |
| 2026 | bmw | ix | Base | 21" |
| 2026 | bmw | m2 | Base | 19", 20" |
| 2026 | bmw | m8 | Base | 20", 20" |
| 2026 | bmw | x1 | Base | 19" |
| 2026 | bmw | x2 | Base | 19" |
| 2026 | bmw | x4 | Base | 19" |
| 2026 | bmw | x4-m | Base | 21", 21" |
| 2026 | bmw | x5-m | Base | 21", 22" |
| 2026 | bmw | x6-m | Base | 21", 22" |

---

## 🔍 Data Quality Checks

### Quality Tier Distribution

| Tier | Count |
|------|-------|
| complete | 15,401 |
| low_confidence | 2,213 |
| partial | 932 |

### Issues Found

- **Duplicate Entries:** 0
- **Invalid Years (<2000 or >2026):** 2705
- **Models with Only 1 Trim (2020+):** 50
- **Empty Bolt Patterns:** 0 (0.00%)

---

## 🚫 Dead End Analysis

### Makes with < 50 Records (Potentially Incomplete)

| Make | Records |
|------|--------|
| delorean | 3 |
| daewoo | 4 |
| polestar | 9 |
| lucid | 11 |
| rivian | 11 |
| datsun | 19 |
| alfa-romeo | 24 |
| rolls-royce | 26 |
| mclaren | 27 |
| eagle | 27 |
| hummer | 27 |
| bentley | 28 |
| scion | 28 |
| fiat | 29 |
| saab | 30 |
| ferrari | 30 |
| lotus | 30 |
| geo | 31 |
| lamborghini | 32 |
| suzuki | 36 |
| saturn | 36 |
| isuzu | 36 |
| aston-martin | 38 |
| genesis | 39 |

### Missing Major Makes

✅ All major makes present

### Missing Popular Models

✅ All popular models present

### Single-Year Models (38 total)

Models that only exist for 1 year (potential data errors):

| Make | Model | Year | Records |
|------|-------|------|---------|
| audi | cabriolet | 2000 | 1 |
| audi | q6l-sportback-e-tron | 2025 | 1 |
| chevrolet | c2500 | 2000 | 1 |
| chevrolet | malibu-limited | 2016 | 1 |
| chevrolet | silverado-1500-classic | 2007 | 1 |
| chevrolet | silverado-1500-hd-classic | 2007 | 1 |
| chevrolet | silverado-1500-limited | 2022 | 1 |
| chevrolet | silverado-2500-hd-classic | 2007 | 1 |
| chevrolet | silverado-3500-classic | 2007 | 1 |
| chevrolet | traverse-limited | 2024 | 1 |
| chrysler | cirrus | 2000 | 1 |
| dodge | stealth | 1993 | 1 |
| ford | contour | 2000 | 1 |
| gmc | acadia-limited | 2017 | 1 |
| gmc | sierra-1500-classic | 2007 | 1 |
| gmc | sierra-2500hd-classic | 2007 | 1 |
| gmc | sierra-3500-classic | 2007 | 1 |
| hyundai | xg300 | 2001 | 1 |
| lincoln | zephyr | 2006 | 1 |
| lucid | gravity | 2024 | 2 |
| mazda | mx-3 | 2000 | 1 |
| mercedes | r-class-amg | 2007 | 1 |
| mercedes-benz | amg-gt | 2020 | 1 |
| mercedes-benz | cla-class | 2016 | 1 |
| mercedes-benz | glc-class | 2021 | 1 |
| mercedes-benz | gle-class | 2022 | 1 |
| mitsubishi | mirage-asti | 2000 | 1 |
| nissan | Frontier | 2024 | 1 |
| nissan | leopard | 2000 | 1 |
| nissan | lucino | 2000 | 1 |

---

## 💡 Recommendations

### ⚠️ HIGH Priority
- **[Coverage]** 98 models missing 2024-2026 data
  - Action: Run targeted import for recent model years

### 📝 LOW Priority
- **[Data Quality]** 2705 records with years outside 2000-2026
  - Action: Review and clean up invalid year data


---

## 📋 Next Steps

1. ✅ Database is ready for production with minor cleanup tasks
2. Address any CRITICAL issues immediately
3. Create import jobs for missing makes/models
4. Run tire size derivation for records with wheels but no tires
5. Schedule regular data quality audits (weekly recommended)

---

*Report generated by final-audit.mjs*
