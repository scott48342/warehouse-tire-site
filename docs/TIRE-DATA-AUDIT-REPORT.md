# Tire Data Audit Report
**Generated:** 2026-04-21
**Scope:** 12,031 vehicles across 161 batches

## Executive Summary

This audit validated our tire fitment database against tiresize.com OEM data. **Significant data quality issues were found across all major makes.**

### Key Findings

| Category | Impact | Action Required |
|----------|--------|-----------------|
| **Phantom Years** | ~200+ vehicles | DELETE - vehicles listed for years they didn't exist |
| **Non-US Vehicles** | ~500+ vehicles | DELETE - JDM, China, Europe-only models |
| **Wrong Tire Sizes** | ~400+ vehicles | UPDATE - incorrect width, aspect ratio, or diameter |
| **Empty Data** | ~300+ vehicles | POPULATE - entire model lines with no tire data |
| **Generation Mismatch** | ~150+ vehicles | UPDATE - wrong gen sizes applied |

---

## Phantom Years (DELETE)

Vehicles listed for model years that don't exist in the US market:

### Toyota
- **FJ Cruiser 2015-2023** - Discontinued in US after 2014
- **Land Cruiser 2021-2023** - Not sold in US during gap years
- **Prius Plug-in 2016-2026** - Discontinued 2015
- **Prius V 2018-2021** - Discontinued 2017
- **Yaris 2021-2026** - Discontinued in US after 2020
- **Venza 2016, 2020** - Gap years (discontinued 2015, returned 2021)
- **Supra 2000-2002** - A80 ended 1998, A90 started 2019
- **GR86 2021** - Started 2022

### Volkswagen
- **Beetle 2020-2024** - Discontinued 2019
- **ID.4 2020** - Started 2021
- **Passat 2023-2026** - Discontinued in US after 2022
- **Taos 2020-2021** - Started 2022
- **Touareg 2018-2026** - Not sold in US after 2017
- **Tiguan 2007-2008** - Not sold in US those years

### Subaru
- **WRX STI 2022-2023** - Discontinued after 2021

### Volvo
- **S60 2000, 2010** - Gap years between generations
- **V60 2010-2014** - Not sold in NA until 2015
- **V90 sedan 2022-2025** - Discontinued after 2021
- **XC40 2017-2018** - Started 2019
- **XC60 2008-2009** - Started 2010
- **XC90 2015** - Gap year between Gen1 and Gen2

### Lexus
- **NX 2014** - Started 2015
- **RC 2014** - Started 2015

### Kia
- **EV6 2021** - Started 2022
- **EV9 2023** - Started 2024
- **Forte 2008-2009** - Started 2010
- **Niro 2016** - Started 2017

### Toyota (Additional)
- **Mirai 2014-2015** - Started 2016

---

## Non-US Market Vehicles (DELETE)

Vehicles that were never sold in the United States:

### JDM (Japan Domestic Market)
- Toyota: Allex, Altezza, Aristo, Blade, Celsior, Funcargo, Gaia, Hilux-Surf, MR-S, Runx, Spacio, Soarer, Vista, Windom, etc.
- Lexus: (sold as Toyota in Japan - Celsior = LS, Aristo = GS, etc.)

### Asia/Indonesia/India
- Toyota: Avanza, Calya, Innova variants (Cross, Crysta, HyCross, Zenix), Fortuner (some years), Rush

### China Market
- Volkswagen: Cross-Lavida, Cross-Santana, ID.4 Crozz, ID Unyx, Jetta King, Jetta Pioneer, Tacqua, Taigo, Tayron-GTE, Tharu

### Europe Only
- Toyota: Proace variants, Picnic
- Volkswagen: Arteon SR (Euro spec)
- Volvo: V40 (all years 2012-2021)

### Other Regional
- Toyota: Hilux Champ (Thailand), Rukus (Australia), Quantum (South Africa), Pronard (Japan), Starlet-Cross (Africa/Middle East)
- Kia: Avella, Besta, Carstar, Enterprise
- Volkswagen: Clasico (Mexico), Jetta City (Canada)

---

## Wrong Tire Sizes (UPDATE)

### Toyota
| Model | Years | Current (Wrong) | Should Be |
|-------|-------|-----------------|-----------|
| Corolla Cross | 2020-2025 | 195/65R15, 205/55R16, 225/40R18 | 215/65R17, 225/55R18 |
| Corolla | 2000-2002 | 195/65R15, 205/55R16, etc. | 175/65R14, 185/65R14 |
| GR Corolla | 2022-2025 | 195/65R15, 205/55R16 | 235/40R18, 245/40R18 |
| 4Runner | 2025-2026 | 265/70R17, 265/65R18 | 245/70R17, 265/55R20, 265/70R18 |
| FJ Cruiser | 2007-2014 | 245/75R16 | 265/75R16 |
| Grand Highlander | 2024-2025 | 235/65R18, 235/55R20 | 255/65R18, 255/55R20 |
| Highlander | 2001-2016 | Various | Various width errors |
| Sequoia | 2023-2026 | 275/60R20 | 265/60R20 |
| Tundra | 2023-2026 | 275/60R20 | 265/60R20 |
| Yaris | 2007-2010 | R15/R16 | R14/R15 (1" diameter off) |
| Prius (all gens) | 2000-2026 | Cross-contaminated | Per-generation specific |
| Sienna Gen4 | 2021-2026 | 235/55R19 | 235/65R17, 235/60R18, 235/50R20 |
| Camry | 2012-2014 | 235/45R18 | 225/45R18 |
| Avalon | 2005-2012 | 205/60R16 | 215/60R16 |
| Venza | 2021-2025 | 225/65R17, 255/45R21 | 225/60R18, 225/55R19 |

### Lexus
| Model | Years | Current (Wrong) | Should Be |
|-------|-------|-----------------|-----------|
| LX | 2022-2026 | 275/55R20, 275/50R22 | 265/55R20, 265/50R22 |
| LX | 2000-2007 | 275/60R17, 275/60R18 | 275/70R16 |
| RC | 2015-2025 | 225/45R17, 235/40R18 | 235/45R18, 235/40R19 |

### Volkswagen
| Model | Years | Current (Wrong) | Should Be |
|-------|-------|-----------------|-----------|
| Arteon | 2020-2025 | 255/40R19, 255/35R20 | 245/40R19, 245/35R20 |
| GTI | 2022-2026 | 225/35R19 | 235/35R19 |
| Jetta | 2019-2026 | 205/55R16, 225/45R17 | 205/60R16, 205/55R17 |
| Passat | 2000-2005 | 235/45R17 | 225/45R17 |
| Passat | 2016 | 215/55R16 | 215/60R16 |

### Volvo
| Model | Years | Current (Wrong) | Should Be |
|-------|-------|-----------------|-----------|
| S60 | 2001-2009 | R19/R20 sizes | Max R18 (Gen1) |
| S60 | 2019-2025 | 235/45R17, 235/40R18 | 235/45R18, 235/40R19 |
| S90 | 2017-2025 | 245mm width | 255mm width |
| XC90 Gen1 | 2003-2014 | Gen2 sizes applied | 225/70R16, 235/65R17, 235/60R18 |

### Suzuki
| Model | Years | Current (Wrong) | Should Be |
|-------|-------|-----------------|-----------|
| Grand Vitara | 2000-2005 | 215/70R16 | 235/60R16 |
| Kizashi | 2010-2013 | 225/55R17 | 215/55R17 |
| SX4 | 2007-2013 | 215/55R17 | 205/50R17 |

### Kia
| Model | Years | Current (Wrong) | Should Be |
|-------|-------|-----------------|-----------|
| Forte GT | 2019-2026 | 235/40R18 | 225/40R18 |

---

## Empty Data (POPULATE)

Model lines with completely empty tire size arrays:

### Toyota
- Solara (all years)
- C-HR (most years)
- GT-86 / 86 (all years - naming issue)
- MR2 Spyder (needs staggered data)

### Volkswagen
- Golf SportWagen (2010-2019)
- Rabbit (2006-2009)
- Routan (2008-2014)
- Tiguan Limited (2017-2018)

### Volvo
- V40 (remove - not US market)
- V50 (2005-2011)
- V90 Cross Country (2016-2025)
- S40 (2004-2012)
- S70 (2000)
- S80 (2007-2016)
- C40 (2021-2025)

### Subaru
- WRX STI (2014-2021) - has data but needs validation

---

## Generation Mismatch Issues

**Pattern Detected:** Some vehicles have tire sizes from wrong generations applied.

### Volvo S60
- 2001-2009 vehicles have 2019+ sizes
- 2019+ vehicles have 2001-2009 sizes
- **Action:** Swap data between generations

### Volvo XC90
- 2003-2014 (Gen1) has Gen2 sizes
- **Action:** Replace with correct Gen1 sizes

### Toyota Prius
- Multiple generations have cross-contaminated data
- Each generation needs distinct tire sizes

### Toyota Mirai
- 2016-2020 (Gen1) has Gen2 sizes
- Gen1: 215/55R17 only
- Gen2 (2021+): 235/55R19, 245/45R20

---

## Recommended Action Plan

### Phase 1: Delete Phantom Years & Non-US Vehicles
```sql
-- Remove phantom years (example)
DELETE FROM vehicle_fitments 
WHERE (make = 'Toyota' AND model = 'FJ Cruiser' AND year > 2014)
   OR (make = 'Volkswagen' AND model = 'Beetle' AND year > 2019)
   OR (make = 'Subaru' AND model = 'WRX STI' AND year > 2021)
   -- ... etc

-- Remove non-US vehicles
DELETE FROM vehicle_fitments
WHERE model IN ('Allex', 'Altezza', 'Aristo', 'Avella', 'Besta', ...)
```

### Phase 2: Fix Wrong Tire Sizes
- Create correction scripts per make
- Prioritize high-volume vehicles (Corolla, Camry, F-150, etc.)

### Phase 3: Populate Empty Records
- Use batch research results to fill empty models
- Prioritize US-market vehicles

### Phase 4: Re-validate
- Run validation again after corrections
- Target: <5% discrepancy rate

---

## Files Generated
- `scripts/tire-validation/results/batch-*.json` - Individual batch results
- `scripts/tire-validation/validation-report.json` - Aggregated findings
- `docs/TIRE-DATA-AUDIT-REPORT.md` - This document

---

*Report compiled from 161 batch validations against tiresize.com OEM data*
