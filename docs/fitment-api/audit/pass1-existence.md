# Pass 1 — Existence & Coverage vs. NHTSA vPIC + EPA (2026-09-15)

**Question answered:** which active `vehicle_fitments` Y/M/M rows are phantoms (never a US model year), and which US-market Y/M/M and trims are missing.
**Scope:** 33,642 active rows, model years 1990–2026 (10,107 distinct Y/M/M). Nothing in `vehicle_fitments` was modified. Results live in CSVs under `docs/fitment-api/audit/pass1/` and tables `audit_pass1_nhtsa_models`, `audit_pass1_epa_vehicles`, `audit_pass1_matches`.

## Method
1. **NHTSA vPIC** `GetModelsForMakeYear/make/{make}/modelyear/{y}/vehicletype/{car|mpv|truck}` for 75 canonical makes (our 65 + eagle/merkur/daihatsu/fisker/vinfast/ineos/maybach/peugeot/yugo/sterling) × 1990–2026 within each make's US sales window. 5,175 calls, 0 failures, all cached in `scripts/audit/pass1/cache/`. Results filtered to the exact `Make_Name` (the endpoint substring-matches, e.g. "mini" → Mack/Peterbilt). → **14,799 model rows, 1,460 make+model.**
2. **EPA** bulk `vehicles.csv` (21.7 MB, 50,241 rows) → 41,837 rows ≥1990, 1,294 make+baseModel. `trim_text` = model name minus `baseModel` minus drivetrain/body noise tokens.
3. **Normalization** (`scripts/audit/pass1/aliases.json`, single source of truth): compact keys (lowercase alnum), make map (`mercedes`→`mercedes-benz`, `* vans`/`* minivans` stripped), 300+ model aliases, 78 regex "family" rules (BMW `328i`→`3series`, Mercedes `C300`/`AMG C63`/`C-Class`→`cclass`, `Silverado 2500HD`→`silverado`, Infiniti `QX56`→`qx80`, Land Rover `LR3/LR4`→`discovery`, …), `/`-split of combined names (`Caravan/Grand Caravan`), sub-brand prefix strip (`Scion xB` under TOYOTA), and year-conditional cross-make search (`ram`≤2012→Dodge, Geo↔Chevrolet, Scion→Toyota, Plymouth→Chrysler/Dodge).
4. **Match levels** per our Y/M/M: `exact` (name/alias), `family` (same model family, e.g. our `silverado-1500` vs NHTSA `Silverado`), `crossmake`, `none`. HD trucks (>8,500 GVWR) are never in EPA and NHTSA lists them generically — family-level is accepted for them.
5. **Phantom severity:** `error` = model never appears in either source for that make in any year 1990–2026, or make not sold in the US that year; `warn` = model exists in other years (phantom model year); `info` = MY2025–2026 with no listing yet (gov sources lag ~1 MY — verify before acting).
6. **Missing list** = NHTSA light-duty (car/MPV/truck, HD/commercial names filtered) Y/M/M with zero matching active row. Because vPIC's per-year model list is VIN-pattern based and over-includes years (e.g. lists Aveo through 2020), each missing year is tagged **EPA-confirmed** or **NHTSA-only**; priority score weights EPA-confirmed years 4× and trucks/SUVs higher.
7. **Trim gaps** (2000+) = EPA `trim_text` for a Y/M/M we have, whose tokens are not all found in our `display_trim`/`raw_trim`/`submodel`/model slug for that Y/M/M.
8. `03-compare.mjs` is offline and deterministic (re-run from cache produced byte-identical counts).

## Limitations (read before acting)
- **vPIC 1990s data is thin** (VIN-pattern derived): the "gov coverage" % for the 1990s understates NHTSA's own completeness, and NHTSA-only missing years for pre-2000 are weak evidence. EPA-confirmed years are solid.
- **MY2025–2026** listings lag in both sources → phantom `info` rows and 2025+ gaps are provisional.
- NHTSA name granularity is coarse for trucks ("Silverado", "Ram", "Express"); we cannot prove `silverado-2500` vs `2500hd` splits from this pass (Pass 2/3 territory).
- EPA "trims" are mostly powertrain/body variants (760Li, Carrera 4S, A8 L, Yukon XL 1500). Some flagged "trim gaps" are really model gaps (Outlander Sport, Yukon XL) or marketing noise (Soul "ECO dynamics", Elantra "Blue"). The list ranks by recurrence across years; treat it as a candidate list.
- ~40 rows/year/model families with generic placeholder trims ("Base | LS" on a BMW 2-Series, "Base | Premium" on a 7-Series) will show many trim gaps — that is a real data-quality signal, not noise.

## Coverage
| Decade | NHTSA light-duty Y/M/M | we cover | % | our rows | matched (any) | exact | unmatched rows |
|---|---|---|---|---|---|---|---|
| 1990s | 3,191 | 1,676 | **52.5%** | 2,969 | 97.8% | 93.2% | 66 |
| 2000s | 3,037 | 2,104 | **69.3%** | 7,865 | 97.8% | 94.5% | 170 |
| 2010s | 3,511 | 2,761 | **78.6%** | 12,447 | 97.8% | 96.3% | 271 |
| 2020s | 2,667 | 2,249 | **84.3%** | 10,361 | 96.5% | 96.4% | 361 |
| **All** | **12,406** | **8,790** | **70.9%** | **33,642** | **97.4%** | 95.6% | 868 |

Per-make: `pass1/coverage-by-make.csv`. Lowest gov coverage among volume makes: Ford 53.6% (1990s F-Series/Ranger/Bronco/Tempo/Festiva + Freestar/Freestyle/Five Hundred/Transit Connect/EcoSport/C-Max), Mitsubishi 54.4%, Infiniti 60.1%, Volvo 63.6%, Chrysler 65.7%, Kia 68.6%, Hyundai 69.3%. Highest: Porsche 99.4%, Hummer 96.6%, Audi 94.3%, BMW 91.6%, MINI 91.5%, Genesis 90.7%, Honda 90.2%.

**Headline:** the 1990s are hollow for the highest-volume vehicles — we have **zero** rows for Toyota Camry 1992–1999, Ford F-150 1992–1999, F-250/F-350 1991–1999, Ranger 1993–1999, 4Runner 1991–1999, Suburban 1992–1999, Sentra/Maxima 1995–1999, Pathfinder 1996–1999 (verified directly in the DB, not just via the matcher).

## Phantom candidates (1995+)
Rows: **59 error / 573 warn / 196 info** (Y/M/M: 57 / 427 / 62). CSVs: `pass1/phantom-candidates-rows.csv` (row ids), `pass1/phantom-candidates-ymm.csv`.
By source (error+warn): `catalog-gap-fill` 196, `catalog-gap-fill [web_research]` 127, `railway_import` 54, `generation` 26, `cache-import` 43, `google-ai-overview` 23, `trim-research` 20 … — the gap-fill batches are the main phantom producers.

### Errors — models that never existed in the US market (59 rows, all should be quarantined)
| Make/model | Years | Rows | Evidence |
|---|---|---|---|
| toyota vios-fs | 2017, 2019–2022 | 5 | Asian-market Vios; never in NHTSA/EPA |
| toyota e-z | 2011–2017 | 7 | Chinese-market Toyota EZ |
| toyota etios-valco | 2011–2017 | 7 | Indonesian Etios |
| toyota soluna | 2000–2003 | 4 | Thai-market |
| toyota grand-hiace | 2000–2002 | 3 | JDM van |
| toyota vienta | 2000 | 1 | Australian Camry |
| mitsubishi maven | 2005–2009 | 5 | Indonesian |
| mitsubishi chariot-grandis | 2000–2003 | 4 | JDM |
| mitsubishi l400 | 2000–2001 | 2 | JDM/Europe van |
| mitsubishi destinator | 2025–2026 | 2 | ASEAN SUV, not US |
| ford sportka | 2003–2008 | 6 | Europe-only Ka |
| ford streetka | 2003–2006 | 4 | Europe-only |
| mercedes eqa | 2021–2026 | 6 | EQA never sold in US |
| alfa romeo 4c | 2014 | 3 | US launch was MY2015 (Alfa absent from US 1996–2014) |

### Top warns — phantom model years (model exists, not that year)
| Make/model | Our phantom years | Gov years | Rows |
|---|---|---|---|
| land rover defender | 2000–2016, 2019 | 1993–1997, 2020+ | 18 |
| jaguar xe | 2015–2016, 2022–2024 | 2017–2021 | 25 |
| ford fiesta | 2000–2010, 2020–2024 | 2011–2019 | 16 |
| audi a3 | 1996–2005, 2014, 2021 | 2006–2013, 2015–2020, 2022+ | 16 |
| mitsubishi montero | 2007–2017, 2019–2021 | 1990–2006 | 14 |
| bmw m5 | 1995, 1999, 2004–05, 2011–12, 2024 | 91–93, 00–03, 06–10, 13–23, 25+ | 13 |
| chevrolet colorado | 2013–2014 | 2004–2012, 2015+ | 12 |
| ford ranger | 2012–2017 | ≤2011, 2019+ | 11 |
| bmw m3 | 2000, 2007, 2014, 2019 | (gaps between generations) | 11 |
| buick regal | 2005–2010, 2021–2024 | ≤2004, 2011–2020 | 10 |
| lexus is | 1999–2000 | 2001+ | 10 |
| dodge challenger | 2024 | 2008–2023 | 9 |
| toyota fj-cruiser | 2015–2017, 2019–2023 | 2007–2014 | 8 |
| chevrolet trailblazer | 2001, 2013–2017, 2019–2020 | 2002–2009, 2021+ | 8 |
| lotus elise | 2013–2021 | 2005–2012 | 8 |
| mercedes amg-gt | 2014–2015 | 2016+ | 8 |
| jaguar f-type | 2012–2013 | 2014+ | 8 |
| kia sorento | 2010 | 2001–2009, 2011+ | 7 |
| mitsubishi i | 2005–2011 | 2012–2018 | 7 |
| toyota yaris | 2000–2006 | 2007–2020 | 7 |
| mercedes a-class-amg | 2013–2017, 2023–2024 | 2019–2022 | 7 |
| ford focus / taurus / fusion | 2019–24 / 2020–24 / 2002–05+2021 | ended 2018 / 2019 / 2020 | 6 / 5 / 5 |
| buick lacrosse / verano | 2020–2024 / 2011, 2019–22 | ended 2019 / 2012–2017 | 5 / 5 |
| audi q7 | 2016 | (no MY2016 Q7 in US) | 5 |
| toyota 86 + gt-86 | 2012–2016, 2021 | Scion FR-S until 2016; GR86 from 2022 | 11 |
Spot-checks of these against known US model-year history all held (Q7 skipped MY2016, Sorento skipped MY2010, BRZ started MY2013, Prius MY2001, GLE MY2016, Bentayga MY2017, RDX MY2007).

Also notable (name rather than existence): our `infiniti qx80` 2004–2013 and `qx50` 2008–2013 rows carry the post-2013 names for what were QX56/EX35 — the family rules match them, but the display names are anachronistic.

## Missing Y/M/M (gap list)
**719 NHTSA models / 3,554 model-years** with zero active rows (`pass1/missing-ymm-nhtsa.csv` by priority, `…-by-make.csv` by make) + **126 EPA-only base models** (`pass1/missing-ymm-epa-only.csv`; mostly tuner/EPA-quirk names — real ones: Toyota Matrix 2003–13, Scion xD 2008–14, Mazdaspeed 3, Chevy Van 1500/2500 1996–2008).

### Top 30 by sales importance (trucks/SUVs/volume first; years = EPA-confirmed unless noted)
1. **Ford F-150 1992–1999** (NHTSA; EPA >8,500 rule excludes some) — zero rows
2. **Toyota Camry 1992–1999** — zero rows
3. **Ford F-250 / F-350 1991–1999** (NHTSA)
4. **Ford Ranger 1993–1999**
5. **Toyota 4Runner 1991–1999**
6. **Chevrolet Suburban 1992–1999** (we have `suburban-1500/2500` only from 2000)
7. **Nissan Frontier 2000–2017** (we have 9 model years total)
8. **Dodge Dakota 2000–2011**
9. **Hyundai Accent 2000–2017, 2019–2022**
10. **Kia Rio 2001–2017, 2019–2023**
11. **Mitsubishi Outlander Sport 2011–2017, 2019–2026** (only 2018 present)
12. **Ford Transit Connect 2010–2017, 2019–2023**
13. **Nissan Sentra 1995–1999, Maxima 1995–1999 & 2004, Pathfinder 1996–1999**
14. **Chevrolet Cavalier 2000–2005, Cobalt 2005–2010, Aveo 2004–2011, Sonic 2012–2020, HHR 2006–2011**
15. **Chevrolet Venture 1997–2005, Uplander 2005–2008; Pontiac Trans Sport 1990–98; Mercury Villager 1993–2002**
16. **Ford Windstar 2000–2003, Freestar 2004–07, Freestyle 2005–07, Five Hundred 2005–07, Crown Victoria 2008–2011, Bronco 1992–1996, EcoSport 2019–2022, C-Max 2013–2017**
17. **Cadillac SRX 2006–2016** (we have 2004–05 only)
18. **Mercedes GL-Class 2007–2016, CLK-Class 1998–2009, R-Class 2006–2013**
19. **Volvo XC70 2004–2016, V70 2000–2010, C70 1998–2013**
20. **Mazda B-Series 2000–2009, Tribute 2001–2011**
21. **Toyota Previa 1991–1997, Paseo 1992–99, MR2 1991–95, Pick-Up 1990–95, Crown 2023–26, Crown Signia 2025–26, Matrix 2003–13 (EPA)**
22. **Nissan Juke 2011–2017, Cube 2009–2014, 350Z 2003–2009, NV200 2013–2021, 200SX 1995–98**
23. **Hyundai Azera 2006–2017, Nexo 2019–26; Kia — see by-make CSV**
24. **Mitsubishi Endeavor 2004–2011, Montero Sport 1997–2004, Raider 2006–2010, Mirage 1990–1999**
25. **Land Rover LR2 2008–2015 (+ LR3/LR4 map to our `discovery` — verify years)**
26. **Infiniti FX35/FX45/FX50 2003–2012, QX56 2004–2013 (names), M35/M45, G35 (see by-make)**
27. **smart Fortwo 2008–2017, 2019** (only 2018 present)
28. **Chrysler Voyager 2001–2003, 2020–2026; Lexus SC 2000–2010**
29. **VW Eos 2007–2016; Audi S7 2013–2025**
30. Luxury: Bentley Continental 1998–2017 & Arnage/Azure/Mulsanne, Aston DB9/DBS/Vanquish, Rolls Phantom 2004–16, Lamborghini Gallardo 2004–14, Lotus Esprit

## Trim gaps (2000–2026)
11,241 EPA variant checks against Y/M/M we have → 5,381 matched, **1,096 distinct (make, model, EPA trim) gaps** (`pass1/trim-gaps.csv`, ranked by years of recurrence).

Top 30: Audi A8 **L** ×16; Porsche 911 **Carrera 4** ×15, **Targa 4S** ×10, **Targa 4** ×9, **Carrera GTS / 4 GTS** ×9, **Targa 4 GTS** ×8; BMW 7-Series **760Li** ×12, **750Li** ×10, **Alpina B7** ×10; Lexus LS **460 L** ×11, **600h L** ×9; Lexus GS **450h** ×10; Mercedes CL **CL600/CL65 AMG/CL550**, ML **ML350/ML63 AMG**, SLK **SLK350/SLK55 AMG**, G **G55 AMG**, AMG GT **53** (each ×8–11); BMW 2-Series **230i/M240i/228i/M235i** ×8–9; BMW X2 **xDrive28i/M35i** ×8, X7 **xDrive40i** ×8, 8-Series **M850i** ×8; Panamera **4S Executive** ×9; Jaguar F-Type **R** ×8; Jeep Wrangler **Unlimited** ×8; Audi A4/A6 **allroad** ×8/×7; Kia Niro **FE** ×9; Saab 9-3 Sport ×10.
Really model gaps surfaced here: Mitsubishi Outlander **Sport** ×15, GMC Yukon **XL** 2000–2013 + 2014–2020 (we have `yukon-xl` only 2018–2024).

## Make-slug findings (`pass1/make-slug-findings.csv`)
- `mercedes` (1,279 rows) **and** `mercedes-benz` (1,578) both active → merge to `mercedes-benz`.
- 2018-only body-style pseudo-makes (all should fold into the real make, 92 rows): `chevrolet minivans` 2, `chevrolet vans` 6, `chrysler minivans` 9, `dodge minivans` 4, `ford minivans` 9, `ford vans` 10, `gmc vans` 6, `honda minivans` 5, `kia minivans` 5, `mercedes-benz minivans` 2, `mercedes-benz vans` 5, `nissan minivans` 3, `nissan vans` 11, `ram minivans` 6, `ram vans` 5, `toyota minivans` 13.
- Cross-brand years: 388 rows under make `ram` for MY ≤2012 are Dodge Ram in both gov sources (matched via cross-make; rename or accept as alias); 9 `geo` rows matched as Chevrolet.
- All 65 of our makes resolved to an NHTSA make; only `sterling` (extra make, not ours) was ambiguous (Sterling Truck vs Sterling Motor Car — dropped).
- Model-slug duplicates visible in `our-model-match-summary.csv`: `town-&-country`/`town-and-country`/`town-country`, `s-10`/`s10`, `mazda3`/`3`, `mx-5`/`mx-5-miata`/`miata`, `gs-f`/`gs`, `3000gt`/`3000-gt`, `f-250`/`f-250-super-duty`, 2018-only per-variant slugs (`330i-xdrive`, `c300`, `gle43-amg`, …).

## Parent should apply (priority order)
1. **Quarantine the 59 `error` rows** — `pass1/phantom-candidates-rows.csv` filter `severity=error` (ids included). Zero ambiguity.
2. **Review + quarantine the 573 `warn` rows** — same CSV, `severity=warn`; `gov_years_for_model` gives the evidence per row. Recommend bulk-accept for models with ≥3 contiguous phantom years (Defender, Fiesta, Montero, Regal, Ranger 2012–17, FJ 2015+, Elise 2013+, A-Class, Yaris 2000–06, Focus/Taurus/LaCrosse/CT6 post-discontinuation) and eyeball single-year boundary cases (`reason` contains "adjacent model year").
3. **Hold the 196 `info` rows** (MY2025–26) until vPIC/EPA catch up; re-run `03-compare.mjs` after refreshing caches (delete `cache/nhtsa_*_2025_*`/`_2026_*` and `epa_vehicles.csv`).
4. **Make-slug merge script**: `mercedes`→`mercedes-benz`; strip ` vans`/` minivans` (92 rows) — `pass1/make-slug-findings.csv`.
5. **Gap fill, tier 1** (1990s volume + trucks): items 1–8 of the Top-30 list; source = `pass1/missing-ymm-nhtsa-by-make.csv` (use `years_missing_epa_confirmed`).
6. **Gap fill, tier 2**: items 9–30; then everything with `n_epa_confirmed ≥ 5`.
7. **Trim backfill** from `pass1/trim-gaps.csv` where `n_years ≥ 5`, after Pass 2 (USAF) confirms sizes.
8. Rename anachronistic Infiniti rows (QX80 2004–13 → QX56, QX50 2008–13 → EX35/EX37) — cosmetic, low priority.

## Files
- Scripts: `scripts/audit/pass1/00-lib.mjs`, `01-fetch-nhtsa.mjs`, `02-fetch-epa.mjs`, `03-compare.mjs`, `04-doc-tables.mjs`, `aliases.json`; cache in `scripts/audit/pass1/cache/` (5,175 NHTSA JSON + `epa_vehicles.csv` + `_03-summary.json`).
- Tables: `audit_pass1_nhtsa_models` (14,799), `audit_pass1_epa_vehicles` (41,837), `audit_pass1_matches` (10,107 Y/M/M with match level + evidence).
- CSVs (`docs/fitment-api/audit/pass1/`): `phantom-candidates-rows.csv`, `phantom-candidates-ymm.csv`, `missing-ymm-nhtsa.csv`, `missing-ymm-nhtsa-by-make.csv`, `missing-ymm-epa-only.csv`, `trim-gaps.csv`, `coverage-by-decade.csv`, `coverage-by-make.csv`, `make-slug-findings.csv`, `our-model-match-summary.csv`, `ymm-matches.csv`.
- Re-run: `node --env-file=.env.local scripts/audit/pass1/03-compare.mjs` (offline, deterministic); `01`/`02` are also cache-first.
