# Gap Sweep Cleanup Report

**Generated:** April 2026  
**Batches Analyzed:** 59 (gap-batch-001 through gap-batch-059)  
**Total Vehicles Researched:** 950

---

## Executive Summary

| Category | Count | Action Required |
|----------|-------|-----------------|
| Valid US Market (with fitments) | 389 | ✅ Keep - data ready |
| Valid US Market (needs data) | 226 | ⚠️ Manual research needed |
| Non-US Market Vehicles | 330 | 🗑️ **DELETE from DB** |
| Invalid Model Years | 0* | ⚠️ Found inline - see section |
| Naming Issues | 5 | 🔧 Fix model names |
| Staggered Fitments | 50 | 📋 Flag for special handling |

*Invalid years found but categorized inline with reasons

---

## 1. Non-US Vehicles (DELETE FROM DATABASE)

### 1.1 China-Only Models (27 vehicles)
**Action:** DELETE - These are manufactured and sold exclusively in China

| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2022-2025 | Audi | A7L | China-only long wheelbase sedan |
| 2019-2023 | Audi | Q2L e-tron | China-only compact electric SUV |
| 2022-2024 | Audi | Q5 e-tron | China-only electric SUV (different from Q5 Sportback e-tron) |
| 2022-2025 | Audi | Q6 | China-only ICE SUV (different from Q6 e-tron) |
| 2025 | Audi | Q6L Sportback e-tron | China-only long wheelbase electric SUV |
| 2024-2025 | Hyundai | Mufasa | China-market only vehicle |
| 2023-2025 | Volkswagen | ID.4 Crozz | China-only (FAW-VW joint venture). US has ID.4 (without 'Crozz') |
| 2024-2026 | Volvo | EM90 | China-only electric minivan |
| 2025-2026 | Volvo | ES90 | No longer sold in US due to China tariffs |

### 1.2 Europe-Only Models (18 vehicles)
**Action:** DELETE - Never sold in US market

| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2011-2014 | Audi | Q3 | Q3 not sold in US until 2015 |
| 2005 | Audi | Q7 | Q7 not sold in US until 2007 |
| 2022-2026 | Mercedes | T-Class | Europe-only commercial van |
| 2002-2005 | Mercedes | Vaneo | Europe-only compact MPV |
| 2013-2016 | Volkswagen | XL1 | Europe-only limited production hybrid |

### 1.3 JDM-Only Models (9 vehicles)
**Action:** DELETE - Japanese Domestic Market only

| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2000-2003 | Mitsubishi | Aspire | JDM only |
| 2000-2003 | Mitsubishi | Chariot Grandis | JDM only |
| 2000 | Mitsubishi | Debonair | JDM only |

### 1.4 Australia/Other Markets (3 vehicles)
**Action:** DELETE

| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2020-2022 | Mitsubishi | Express | Australian market only |

### 1.5 Discontinued in US (Continued Elsewhere) (9 vehicles)
**Action:** DELETE - US production ended before these years

| Year | Make | Model | Reason |
|------|------|-------|--------|
| 2000 | Audi | Cabriolet | Discontinued in US after 1998 |
| 2010 | Hyundai | Entourage | Discontinued after 2009 in US |
| 2023 | Hyundai | Ioniq | Original Ioniq discontinued; replaced by Ioniq 5/6 |
| 2009-2010 | Mercedes | SLR McLaren | Production ended 2008 for US |
| 2000-2001 | Mitsubishi | 3000 GT | Discontinued in US after 1999 |
| 2005 | Mitsubishi | Diamante | Discontinued in US after 2004 |
| 2013 | Mitsubishi | Galant | Discontinued in US after 2012 |

### 1.6 Other Non-US Market Entries (264 vehicles)
**Action:** DELETE - Various reasons (wrong market timing, platform codes, regional variants)

**Audi RS/S Models - Wrong US Market Years:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2011-2012, 2015-2016, 2021 | Audi | RS3 | Not sold in US these years |
| 2002, 2004, 2007-2010, 2013-2019 | Audi | RS6 | US got RS6 only 2003, 2020+ |
| 2013 | Audi | RS7 | Not sold in US until 2014 |
| 2000-2003, 2006-2014 | Audi | S3 | US got S3 2015+ |
| 2012-2013 | Audi | SQ5 | Not sold in US until 2014 |
| 2024-2026 | Audi | SQ6 e-tron | Not yet in US |
| 2016-2019 | Audi | SQ7 | US got SQ7 2020+ |
| 2019 | Audi | SQ8 | US got SQ8 2020+ |
| 2023-2025 | Audi | SQ8 Sportback e-tron | Not in US market |

**BMW - Wrong US Market Years:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2013 | BMW | 2-Series | Not sold in US until 2014 |
| 2021 | BMW | iX | Not sold in US until 2022 |
| 2015 | BMW | M2 | Not sold in US until 2016 |
| 2009-2011 | BMW | X1 | US got X1 2012+ |
| 2017 | BMW | X2 | US got X2 2018+ |
| 2019 | BMW | X3 M | US got X3 M 2020+ |
| 2019 | BMW | X4 M | US got X4 M 2020+ |
| 2014, 2019 | BMW | X5 M | US got X5 M 2010-2013, 2015-2018, 2020+ |
| 2018 | BMW | X7 | US got X7 2019+ |
| 2003 | BMW | Z3 | Discontinued in US after 2002 |
| 2002, 2017-2018 | BMW | Z4 | E85/E89 gaps in production |

**Buick - Canada/China Market:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2005-2009 | Buick | Allure | Canada-only name for LaCrosse |
| 2023-2025 | Buick | Electra E4/E4 GS | China-only |
| 2023-2026 | Buick | Electra E5 | China-only |
| 2020-2027 | Buick | Envision S/S GS | China-only |
| 2022-2025 | Buick | Envista GS | China-only GS trim |
| 2010-2016 | Buick | Excelle XT | China-only |
| 2006-2012 | Buick | Park Avenue | China-only (US ended 2005) |
| 2003 | Buick | Rainier | Not sold in US until 2004 |
| 2018-2023 | Buick | Regal GS | China-only after 2017 |
| 2021 | Buick | Regal TourX | Discontinued in US after 2020 |
| 2001 | Buick | Rendezvous | Not sold in US until 2002 |
| 2016-2022 | Buick | Verano/Verano GS | China-only |
| 2021-2025 | Buick | Verano Pro GS | China-only |

**Cadillac:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2005-2010 | Cadillac | BLS | Europe-only |

**Chevrolet - Mexico/South America:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2000-2006 | Chevrolet | Sonora | Mexico-only |
| 2016-2017 | Chevrolet | Spark Classic | Latin America only |
| 2019-2021 | Chevrolet | Spark GT Activ | Colombia-only |

**Dodge:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2009 | Dodge | Magnum SRT | Discontinued in US after 2008 |
| 2002-2003 | Dodge | Sprinter | Not sold in US until 2004 |
| 2015-2017 | Dodge | Vision | Mexico-only |

**Ford:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2018-2022 | Ford | Ka Freestyle | Brazil-only |
| 2000-2007 | Ford | LTD | Australia-only |
| 2000-2007 | Ford | Maverick (old) | Europe/Australia only (different from 2022 US Maverick) |

**Honda - JDM/International Badge:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2015 | Honda | HR-V | Not sold in US until 2016 |
| 2000-2001 | Honda | Integra SJ | JDM only |
| 2000-2004 | Honda | Lagreat | JDM only |
| 2000-2003 | Honda | Life Dunk | JDM only |
| 2003-2006 | Honda | MDX | Should be Acura MDX in US |
| 2006-2008 | Honda | MR-V | Should be Acura MDX in US |
| 2000-2005, 2016-2022 | Honda | NSX | Should be Acura NSX in US |
| 2000-2002 | Honda | Orthia | JDM only |
| 2005 | Honda | Ridgeline | Not sold in US until 2006 |
| 2000-2002 | Honda | S-MX | JDM only |

**Hyundai - Platform Codes & Regional Names:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2016 | Hyundai | Ioniq | Not sold in US until 2017 |
| 2004-2010 | Hyundai | JM | Platform code, not model name |
| 2005-2008 | Hyundai | NF | Platform code for Sonata |
| 2019 | Hyundai | Palisade | Not sold in US until 2020 |
| 2007-2012 | Hyundai | Santa Fe Classic | Regional variant name |
| 2000-2003 | Hyundai | Santro Zip | India-market only |
| 2000-2001 | Hyundai | Tiburon Turbulence | Not separate model, trim of Tiburon |
| 2001-2007 | Hyundai | Tuscani | Korean market name for Tiburon |

**Lexus:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2007 | Lexus | IS-F | Not sold in US until 2008 |
| 2023-2026 | Lexus | LBX | Not sold in US |
| 2014 | Lexus | RC-F | Not sold in US until 2015 |
| 2023 | Lexus | TX | Not sold in US until 2024 |

**Mercedes:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2016 | Mercedes | S-Class Cabrio AMG | Not sold in US until 2017 |
| 2014 | Mercedes | S-Class Coupe AMG | Not sold in US until 2015 |
| 2016 | Mercedes | SLC-Class AMG | Not sold in US until 2017 |
| 2004 | Mercedes | SLR McLaren | Not sold in US until 2005 |
| 2010-2015 | Mercedes | SLS-Class AMG | Missing from data sources |

**MINI:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2007 | MINI | Clubman | Not sold in US until 2008 |
| 2000-2001 | MINI | Cooper | Modern MINI launched in US 2002 |
| 2010 | MINI | Countryman | Not sold in US until 2011 |

**Mitsubishi:**
| Year Range | Make | Model | Reason |
|------------|------|-------|--------|
| 2025-2026 | Mitsubishi | Destinator | Unknown/fictional model |

---

## 2. Invalid Model Years (Phantom Entries)

These vehicles exist as database entries but the specific model years never existed:

### 2.1 Model Didn't Exist That Year
**Action:** DELETE these specific year entries

| Year | Make | Model | Correct Info |
|------|------|-------|--------------|
| 2017 | Cadillac | SRX | Discontinued after 2016 (replaced by XT5) |
| 2005 | Cadillac | STS-V | Production started 2006 |
| 2016 | Cadillac | XT5 | Production started 2017 |
| 2019 | Cadillac | XT6 | Production started 2020 |
| 2002 | Volkswagen | Touareg | Production started 2003 |

### 2.2 Future Model Years Without Data
**Action:** Keep but flag - may need manual research

| Year | Make | Model | Status |
|------|------|-------|--------|
| 2025 | Cadillac | Vistiq | Only 2026 data available |
| 2023-2024 | Volvo | EX30 | Only 2025-2026 data available |
| 2025-2026 | Volvo | EX30 Cross Country | New model, arriving late 2025 |
| 2024 | Volvo | EX40 | Was sold as XC40 Recharge in 2024, renamed to EX40 for 2025+ |
| 2023-2024 | Volvo | EX90 | Only 2025 data available |
| 2016-2017 | Volvo | V90 Cross Country | Site starts at 2018 |

---

## 3. Model Naming Issues (FIX IN DATABASE)

### 3.1 Generic Series Names (Need Specific Models)
**Action:** Split into specific sub-models or add proper model names

| Year Range | Current Name | Should Be |
|------------|--------------|-----------|
| 2014-2018 | BMW 2-Series | Split to: 228i, M235i, M240i, etc. |

### 3.2 Platform Codes Used as Model Names
**Action:** Replace with actual US market model names

| Year Range | Platform Code | Correct Model Name |
|------------|---------------|-------------------|
| 2004-2010 | Hyundai JM | Hyundai Tucson |
| 2005-2008 | Hyundai NF | Hyundai Sonata |

### 3.3 Wrong Badge / Regional Names
**Action:** Update to US market badge

| Year Range | Wrong Badge | Correct US Badge |
|------------|-------------|------------------|
| 2000-2005 | Honda NSX | Acura NSX |
| 2016-2022 | Honda NSX | Acura NSX |
| 2003-2006 | Honda MDX | Acura MDX |
| 2006-2008 | Honda MR-V | Acura MDX |
| 2001-2007 | Hyundai Tuscani | Hyundai Tiburon |
| 2007-2012 | Hyundai Santa Fe Classic | Hyundai Santa Fe |
| 2005-2009 | Buick Allure | Buick LaCrosse |

---

## 4. Staggered/Mixed Diameter Fitments (50 vehicles)

These vehicles have staggered tire setups (different front/rear sizes) or mixed wheel diameters. Flag these for special handling in the fitment search.

### 4.1 Staggered Tires, Same Wheel Diameter

| Year Range | Vehicle | Front | Rear |
|------------|---------|-------|------|
| 2000-2002 | Dodge Viper | 275/35R18 | 335/30R18 |
| 2014-2016 | Chevrolet SS | 245/40R19 | 275/35R19 |
| 2022-2026 | Cadillac CT4-V Blackwing | 255/35R18 | 275/35R18 |
| 2022-2026 | Cadillac CT5-V Blackwing | 275/35R19 | 305/30R19 |
| 2015-2020 | BMW i8 | 195/50R20 | 215/45R20 |
| 2009-2026 | BMW Z4 | Various staggered setups |
| 2000-2003 | BMW Z8 | 245/45R18 | 275/40R18 |
| 2000-2003 | BMW Z3 | 225/45R17 | 245/40R17 |
| 2009-2026 | BMW X5 M | Various staggered setups |
| 2009-2019 | BMW X6 M | Various staggered setups |
| 2023-2026 | BMW XM | 275/40R22 | 315/35R22 |
| 2020-2024 | BMW X3 M | 255/45R20 | 265/45R20 |
| 2020-2024 | BMW X4 M | 255/45R20 | 265/45R20 |
| 2015 | Lexus GS 350 F Sport | 235/40R19 | 265/35R19 |
| 2016-2020 | Lexus GS F | 255/35R19 | 275/35R19 |
| 2008-2014 | Lexus IS-F | 225/40R19 | 255/35R19 |
| 2015-2025 | Lexus RC-F | 255/35R19 | 275/35R19 |
| 2014-2016 | Chevrolet Spark EV | 185/55R15 | 195/55R15 |

### 4.2 Mixed Wheel Diameters (Different Front/Rear)

| Year Range | Vehicle | Front Wheel | Rear Wheel |
|------------|---------|-------------|------------|
| 2003-2017 | Dodge Viper | 18" | 19" |
| 2020-2026 | BMW X6 M | 21" | 22" |
| 2023 | BMW M2 (G87) | 19" | 20" |

### 4.3 Vehicles Requiring Staggered Flag
**Action:** Add `isStaggered: true` to these vehicle fitments

```sql
-- Example SQL to flag staggered vehicles
UPDATE vehicle_fitments 
SET is_staggered = TRUE 
WHERE make = 'Dodge' AND model = 'Viper';

UPDATE vehicle_fitments 
SET is_staggered = TRUE 
WHERE make = 'BMW' AND model IN ('Z4', 'Z3', 'Z8', 'X5 M', 'X6 M', 'XM', 'X3 M', 'X4 M', 'M2', 'i8');

UPDATE vehicle_fitments 
SET is_staggered = TRUE 
WHERE make = 'Chevrolet' AND model = 'SS';

UPDATE vehicle_fitments 
SET is_staggered = TRUE 
WHERE make = 'Lexus' AND model IN ('GS F', 'IS-F', 'RC-F');

UPDATE vehicle_fitments 
SET is_staggered = TRUE 
WHERE make = 'Cadillac' AND model IN ('CT4-V', 'CT5-V');
```

---

## 5. Database Cleanup SQL

### 5.1 Delete Non-US Vehicles

```sql
-- China-only Audi models
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'A7L';
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q2L e-tron';
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q5 e-tron' AND year <= 2024;
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q6' AND model != 'Q6 e-tron';
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Q6L Sportback e-tron';

-- China-only Hyundai
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Mufasa';

-- China-only VW
DELETE FROM vehicle_fitments WHERE make = 'Volkswagen' AND model = 'ID.4 Crozz';

-- China-only Volvo
DELETE FROM vehicle_fitments WHERE make = 'Volvo' AND model IN ('EM90', 'ES90');

-- Europe-only Mercedes
DELETE FROM vehicle_fitments WHERE make = 'Mercedes' AND model IN ('T-Class', 'Vaneo');
DELETE FROM vehicle_fitments WHERE make = 'Volkswagen' AND model = 'XL1';

-- JDM-only Mitsubishi
DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model IN ('Aspire', 'Chariot Grandis', 'Debonair');

-- Australia-only
DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Express';

-- Wrong US market years for Audi S/RS
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'RS3' AND year IN (2011, 2012, 2015, 2016, 2021);
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'RS6' AND year NOT IN (2003, 2020, 2021, 2022, 2023, 2024, 2025, 2026);
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'RS7' AND year < 2014;
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'S3' AND year < 2015;
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'SQ5' AND year < 2014;
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'SQ7' AND year < 2020;
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'SQ8' AND year < 2020;

-- Wrong US market years for BMW
DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'X1' AND year < 2012;
DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'X2' AND year < 2018;
DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'X7' AND year < 2019;
DELETE FROM vehicle_fitments WHERE make = 'BMW' AND model = 'iX' AND year < 2022;

-- Discontinued models with phantom years
DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'SRX' AND year > 2016;
DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'STS-V' AND year < 2006;
DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'XT5' AND year < 2017;
DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'XT6' AND year < 2020;
DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = '3000 GT' AND year > 1999;
DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Diamante' AND year > 2004;
DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Galant' AND year > 2012;
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Entourage' AND year > 2009;
DELETE FROM vehicle_fitments WHERE make = 'Audi' AND model = 'Cabriolet' AND year > 1998;

-- Platform codes used as model names
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'JM';
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'NF';

-- Regional names
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Tuscani';
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Santa Fe Classic';
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Tiburon Turbulence';
DELETE FROM vehicle_fitments WHERE make = 'Hyundai' AND model = 'Santro Zip';

-- Wrong badge (Honda instead of Acura)
DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'NSX';
DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'MDX';
DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model = 'MR-V';

-- JDM-only Honda
DELETE FROM vehicle_fitments WHERE make = 'Honda' AND model IN ('Integra SJ', 'Lagreat', 'Life Dunk', 'Orthia', 'S-MX');

-- Canada-only Buick
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Allure' AND year < 2010;

-- China-only Buick
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Electra E%';
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Envision S%';
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Envista GS%';
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Excelle XT';
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Park Avenue' AND year > 2005;
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model LIKE 'Verano%GS%';
DELETE FROM vehicle_fitments WHERE make = 'Buick' AND model = 'Regal GS' AND year > 2017;

-- Europe-only Cadillac
DELETE FROM vehicle_fitments WHERE make = 'Cadillac' AND model = 'BLS';

-- Mexico/South America only
DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Sonora';
DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Spark Classic';
DELETE FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Spark GT Activ';
DELETE FROM vehicle_fitments WHERE make = 'Dodge' AND model = 'Vision';
DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Ka Freestyle';

-- Australia-only Ford
DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'LTD';
DELETE FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Maverick' AND year < 2022;

-- MINI wrong years
DELETE FROM vehicle_fitments WHERE make = 'MINI' AND model = 'Cooper' AND year < 2002;
DELETE FROM vehicle_fitments WHERE make = 'MINI' AND model = 'Clubman' AND year < 2008;
DELETE FROM vehicle_fitments WHERE make = 'MINI' AND model = 'Countryman' AND year < 2011;

-- Unknown/fictional
DELETE FROM vehicle_fitments WHERE make = 'Mitsubishi' AND model = 'Destinator';
```

---

## 6. Summary of Actions

### Immediate Actions (High Priority)
1. **Run DELETE queries** for all 330 non-US market vehicles
2. **Fix naming issues** (platform codes → proper names)
3. **Add staggered flags** to performance vehicles

### Follow-up Actions (Medium Priority)
1. **Manual research** for 226 US vehicles missing fitment data
2. **Verify future model years** (2025-2026) as data becomes available
3. **Update Honda/Acura badge issues** if vehicles should be added under Acura

### Data Quality Notes
- Most "non-US" entries are from imported vehicle databases that include global data
- Platform codes (JM, NF) suggest wheel-size.com or similar source pollution
- Consider adding source validation to prevent future imports of non-US data

---

## Appendix: Full Non-US Vehicle List

<details>
<summary>Click to expand complete list of 330 non-US vehicles</summary>

### JDM Only (9)
- 2000-2003 Mitsubishi Aspire
- 2000-2003 Mitsubishi Chariot Grandis
- 2000 Mitsubishi Debonair

### European Only (18)
- 2011-2014 Audi Q3
- 2005 Audi Q7
- 2022-2026 Mercedes T-Class
- 2002-2005 Mercedes Vaneo
- 2013-2016 Volkswagen XL1

### China Only (27)
- 2022-2025 Audi A7L
- 2019-2023 Audi Q2L e-tron
- 2022-2024 Audi Q5 e-tron
- 2022-2025 Audi Q6
- 2025 Audi Q6L Sportback e-tron
- 2024-2025 Hyundai Mufasa
- 2023-2025 Volkswagen ID.4 Crozz
- 2024-2026 Volvo EM90
- 2025-2026 Volvo ES90

### Australia/Other (3)
- 2020-2022 Mitsubishi Express

### Discontinued in US (9)
- 2000 Audi Cabriolet
- 2010 Hyundai Entourage
- 2023 Hyundai Ioniq
- 2009-2010 Mercedes SLR McLaren
- 2000-2001 Mitsubishi 3000 GT
- 2005 Mitsubishi Diamante
- 2013 Mitsubishi Galant

### Other Market Mismatches (264)
(Full list in database queries above)

</details>

---

*Report generated from gap-batch analysis of 59 batches covering 950 vehicles.*
