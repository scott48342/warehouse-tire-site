# Pass 2 — OE Tire Sizes vs. US AutoForce (GetVehicleOptions)

Generated 2026-09-15T16:10:44.681Z · rows compared **33,753** (active `vehicle_fitments`, 1990–2026) · distinct Y/M/M **10,545** · USAF HTTP calls made 6,328 (cached call log: `scripts/audit/pass2/cache/_calls.jsonl`).

## Method
- Source: US AutoForce SOAP `GetVehicleOptions(year, make, model)` via our prod admin route `/api/admin/usaf-vehicle?action=options` (creds live only on Vercel). **USAF exposes no make/model list** — the WSDL (`scripts/audit/pass2/_wsdl.xml`) has only `GetVehicleOptions`; the route's `action=makes|models` return SOAP 500 because those operations do not exist. USAF returns OE sizes per **Y/M/M only, no trims**, so each of our rows is compared against the union of USAF sizes for its Y/M/M, and each Y/M/M's USAF sizes are compared against the union of all our active trims.
- Name matching (`lib.mjs`): ranked candidates per Y/M/M, stop at first hit for model-level names — learned names for the same make+model (other years) → slug transforms (`f-150`→`F-150`, `silverado-2500hd`→`Silverado 2500 HD`, `es-350`→`ES350`) → overrides learned from probes → aliases.json equivalents → GM series toggles (`Suburban`↔`Suburban 1500`). When nothing hits, or for family slugs (`bmw 3-series`, `mercedes c-class`, `lexus es`), **all** trim-derived variants are tried and unioned: `<Model> <Trim>` (USAF splits 2005–2010 Dodge Rams as `Ram 1500 Laramie/SLT/ST/Sport/TRX4/SRT-10`) and make-specific variant names (`AMG C 43 4MATIC`→`C43 AMG`, `ES 350`→`ES350`, `330i xDrive`). USAF names are case-insensitive; spacing/hyphens matter. Every call (positive and negative) is cached; 01 is resumable.
- Normalization (both sides, `normTire`): uppercase, strip spaces; drop `P`/`LT`/`T` prefixes, `Z`/speed letters before `R`, `RF` run-flat, `C` commercial, `/C../E` load range, trailing load index/speed; flotation `33x12.50R20LT/C`→`33X12.50R20`. Vintage alpha/bias sizes (`F70-14`, `8.00-15`) are unparseable → excluded from comparison (46 rows carry at least one unparseable string).
- Row status: **match** = all our sizes ∈ USAF · **partial** = some of ours ∉ USAF · **mismatch** = none of ours ∈ USAF · **our_empty** = no parseable size on our row · **usaf_missing_ymm** = no USAF model name matched (could be USAF gap, a naming miss, or a phantom Y/M/M). Trim-level status (`trim_status`) is additionally recorded when the USAF model name embeds our trim (e.g. `Ram 1500 Laramie`) — 1,378 rows.
- Nothing in `vehicle_fitments` was modified. Results: tables `audit_pass2_usaf_sizes`, `audit_pass2_unmatched`, `audit_pass2_results` (per row), `audit_pass2_ymm` (per Y/M/M); CSVs in `docs/fitment-api/audit/pass2/`.

## USAF coverage of our Y/M/M
| Y/M/M | count | share |
|---|---|---|
| total active Y/M/M 1990–2026 | 10,545 | 100% |
| matched a USAF model (≥1 size) | 9,536 | 90.4% |
| no USAF match (usaf_missing_ymm) | 1,009 | 9.6% |
| not fetched | 0 | 0.0% |

Per-Y/M/M size agreement (union of our trims vs USAF):
| Y/M/M status | count | share |
|---|---|---|
| exact | 2,442 | 23.2% |
| ours_subset | 1,165 | 11.0% |
| overlap | 5,034 | 47.7% |
| disjoint | 895 | 8.5% |
| usaf_missing_ymm | 1,009 | 9.6% |

`exact` = same set · `ours_subset` = we list fewer sizes than USAF (missing OE sizes) · `overlap` = both extra and missing · `disjoint` = nothing in common.

By decade (Y/M/M):
| decade | exact | ours_subset | overlap | disjoint | our_empty | usaf_missing_ymm | not_fetched |
|---|---|---|---|---|---|---|---|
| 1990s | 550 | 301 | 751 | 229 | 0 | 138 | 0 |
| 2000s | 381 | 257 | 1,375 | 300 | 0 | 244 | 0 |
| 2010s | 952 | 333 | 1,611 | 164 | 0 | 302 | 0 |
| 2020s | 559 | 274 | 1,297 | 202 | 0 | 325 | 0 |

## Row status counts
Overall (33,753 rows; 32,068 comparable = match+partial+mismatch):
| scope | rows | match | partial | mismatch | our_empty | usaf_missing_ymm | not_fetched |
|---|---|---|---|---|---|---|---|
| all | 33,753 | 15,996 (47.4%) | 12,206 (36.2%) | 3,866 (11.5%) | 14 (0.0%) | 1,671 (5.0%) | 0 (0.0%) |

By decade:
| decade | rows | match | partial | mismatch | our_empty | usaf_missing_ymm | not_fetched |
|---|---|---|---|---|---|---|---|
| 1990s | 3,080 | 1,357 (44.1%) | 952 (30.9%) | 568 (18.4%) | 8 (0.3%) | 195 (6.3%) | 0 (0.0%) |
| 2000s | 7,865 | 2,978 (37.9%) | 3,132 (39.8%) | 1,388 (17.6%) | 6 (0.1%) | 361 (4.6%) | 0 (0.0%) |
| 2010s | 12,447 | 6,465 (51.9%) | 4,434 (35.6%) | 1,034 (8.3%) | 0 (0.0%) | 514 (4.1%) | 0 (0.0%) |
| 2020s | 10,361 | 5,196 (50.1%) | 3,688 (35.6%) | 876 (8.5%) | 0 (0.0%) | 601 (5.8%) | 0 (0.0%) |

By `source` family (bracket suffixes like `[expanded]` folded in; sorted by rows):
| source family | rows | match | partial | mismatch | our_empty | usaf_missing | match % of comparable |
|---|---|---|---|---|---|---|---|
| cache-import | 7,296 | 2,183 | 4,423 | 285 | 0 | 405 | 31.7% |
| trim-research | 4,548 | 3,790 | 248 | 475 | 0 | 35 | 84.0% |
| google-ai-overview | 3,330 | 2,006 | 367 | 852 | 0 | 105 | 62.2% |
| api_import | 2,454 | 568 | 1,631 | 197 | 0 | 58 | 23.7% |
| generation_inherit | 1,843 | 732 | 364 | 693 | 0 | 54 | 40.9% |
| generation_template | 1,834 | 658 | 988 | 134 | 6 | 48 | 37.0% |
| verified-research | 1,633 | 1,125 | 352 | 83 | 0 | 73 | 72.1% |
| catalog-gap-fill | 1,546 | 164 | 492 | 389 | 0 | 501 | 15.7% |
| tgp_solutions | 1,474 | 1,466 | 3 | 2 | 0 | 3 | 99.7% |
| 90s-research-batch | 1,435 | 682 | 523 | 136 | 0 | 94 | 50.9% |
| generation-baseline | 1,219 | 176 | 898 | 130 | 0 | 15 | 14.6% |
| manual-research | 1,146 | 219 | 716 | 211 | 0 | 0 | 19.1% |
| manual_seed_spec | 585 | 277 | 279 | 6 | 0 | 23 | 49.3% |
| merged-staggered | 326 | 326 | 0 | 0 | 0 | 0 | 100.0% |
| railway_import | 322 | 115 | 134 | 2 | 0 | 71 | 45.8% |
| generation | 290 | 83 | 140 | 24 | 0 | 43 | 33.6% |
| tier-a-import | 274 | 161 | 82 | 11 | 0 | 20 | 63.4% |
| batch2v2-trim-groups | 159 | 140 | 8 | 11 | 0 | 0 | 88.1% |
| cleanup_cache-import | 146 | 51 | 66 | 26 | 0 | 3 | 35.7% |
| oem_specs | 142 | 26 | 94 | 22 | 0 | 0 | 18.3% |
| luxury-gap-fill | 129 | 77 | 10 | 17 | 0 | 25 | 74.0% |
| tiresize.com | 124 | 112 | 2 | 9 | 0 | 1 | 91.1% |
| final-gap-fill | 118 | 29 | 62 | 19 | 0 | 8 | 26.4% |
| audit-2026-09-pass3-research | 107 | 83 | 9 | 3 | 8 | 4 | 87.4% |
| cleanup_generation_template | 103 | 77 | 26 | 0 | 0 | 0 | 74.8% |
| batch7-subcompacts-final | 87 | 56 | 16 | 0 | 0 | 15 | 77.8% |
| merge_consolidation | 83 | 37 | 10 | 36 | 0 | 0 | 44.6% |
| fix_cross_gen | 74 | 61 | 6 | 7 | 0 | 0 | 82.4% |
| batch6-minivans-evs | 67 | 19 | 17 | 8 | 0 | 23 | 43.2% |
| batch5-sports-more | 61 | 47 | 4 | 10 | 0 | 0 | 77.0% |
| backfill-gc | 60 | 34 | 13 | 13 | 0 | 0 | 56.7% |
| manual_backfill | 56 | 4 | 20 | 26 | 0 | 6 | 8.0% |
| alias-from-mazda3 | 53 | 27 | 25 | 0 | 0 | 1 | 51.9% |
| cleanup_legacy_mazda_mx-5-miata | 51 | 50 | 1 | 0 | 0 | 0 | 98.0% |
| manufacturer_spec | 47 | 38 | 9 | 0 | 0 | 0 | 80.9% |
| wheelsize | 45 | 33 | 12 | 0 | 0 | 0 | 73.3% |
| cleanup_wheelsize | 41 | 41 | 0 | 0 | 0 | 0 | 100.0% |
| reddit-correction-2026-09-15 | 40 | 11 | 24 | 5 | 0 | 0 | 27.5% |
| generation_inherit_2015 | 36 | 0 | 36 | 0 | 0 | 0 | 0.0% |
| batch1-fill | 36 | 28 | 0 | 8 | 0 | 0 | 77.8% |
| generation_inherit_2025 | 30 | 11 | 13 | 0 | 0 | 6 | 45.8% |
| platform_inheritance_ld | 27 | 17 | 7 | 0 | 0 | 3 | 70.8% |
| manual | 26 | 14 | 12 | 0 | 0 | 0 | 53.8% |
| generation_inherit_2023 | 18 | 0 | 0 | 0 | 0 | 18 | n/a |
| intrepid-gap-fill-2026-08-31 | 16 | 16 | 0 | 0 | 0 | 0 | 100.0% |
| gap-fix | 13 | 0 | 13 | 0 | 0 | 0 | 0.0% |
| batch4-suvs-sedans | 13 | 12 | 0 | 1 | 0 | 0 | 92.3% |
| cleanup_corvette_c5 | 12 | 12 | 0 | 0 | 0 | 0 | 100.0% |
| manual_import | 12 | 11 | 0 | 1 | 0 | 0 | 91.7% |
| cleanup_legacy_bmw_3-series | 11 | 4 | 7 | 0 | 0 | 0 | 36.4% |
| generation_inherit_2024 | 10 | 0 | 0 | 0 | 0 | 10 | n/a |
| manual-import | 9 | 8 | 1 | 0 | 0 | 0 | 88.9% |
| generation_inherit_2022 | 9 | 9 | 0 | 0 | 0 | 0 | 100.0% |
| manual-qa-fix | 8 | 4 | 0 | 4 | 0 | 0 | 50.0% |
| chevy-gmc-research | 8 | 8 | 0 | 0 | 0 | 0 | 100.0% |
| inherited_from_2018_SIBLING_PLATFORM | 8 | 4 | 4 | 0 | 0 | 0 | 50.0% |
| inherited_from_2007_SAME_GENERATION | 8 | 0 | 8 | 0 | 0 | 0 | 0.0% |
| tire-guide-pro-import | 7 | 7 | 0 | 0 | 0 | 0 | 100.0% |
| manual_fix_escalade_2026 | 6 | 0 | 6 | 0 | 0 | 0 | 0.0% |
| batch3-sports-cars | 6 | 6 | 0 | 0 | 0 | 0 | 100.0% |
| backfill-2014 | 6 | 4 | 1 | 1 | 0 | 0 | 66.7% |
| reviewed_from_2025_ADJACENT_YEAR | 6 | 6 | 0 | 0 | 0 | 0 | 100.0% |
| demo-fix | 5 | 2 | 0 | 3 | 0 | 0 | 40.0% |
| inherited_from_2020_SAME_GENERATION | 5 | 4 | 1 | 0 | 0 | 0 | 80.0% |
| generation_import | 5 | 0 | 0 | 5 | 0 | 0 | 0.0% |
| reviewed_from_2021_ADJACENT_YEAR | 4 | 2 | 2 | 0 | 0 | 0 | 50.0% |
| fix_cross_gen_contamination | 4 | 1 | 3 | 0 | 0 | 0 | 25.0% |
| static | 4 | 4 | 0 | 0 | 0 | 0 | 100.0% |
| tire-guide-pro | 4 | 4 | 0 | 0 | 0 | 0 | 100.0% |
| generation_inherit_2018 | 4 | 1 | 3 | 0 | 0 | 0 | 25.0% |
| inherited_from_2015_SAME_GENERATION | 4 | 0 | 4 | 0 | 0 | 0 | 0.0% |
| inherited_from_2019_SAME_GENERATION | 4 | 4 | 0 | 0 | 0 | 0 | 100.0% |
| manual-fix | 3 | 2 | 1 | 0 | 0 | 0 | 66.7% |
| platform_inheritance_lx | 3 | 0 | 3 | 0 | 0 | 0 | 0.0% |
| manual_research | 3 | 2 | 0 | 1 | 0 | 0 | 66.7% |
| reviewed_from_2013_ADJACENT_YEAR | 2 | 0 | 2 | 0 | 0 | 0 | 0.0% |
| inherited_from_2020_SIBLING_PLATFORM | 2 | 2 | 0 | 0 | 0 | 0 | 100.0% |
| reviewed_from_2020_ADJACENT_YEAR | 2 | 0 | 2 | 0 | 0 | 0 | 0.0% |
| tire-guide-manual | 1 | 1 | 0 | 0 | 0 | 0 | 100.0% |
| reviewed_from_2018_ADJACENT_YEAR | 1 | 1 | 0 | 0 | 0 | 0 | 100.0% |
| wheel_fill_chevrolet_corvette_from_2024 | 1 | 1 | 0 | 0 | 0 | 0 | 100.0% |
| reviewed_from_2022_ADJACENT_YEAR | 1 | 0 | 1 | 0 | 0 | 0 | 0.0% |
| priority-fix | 1 | 0 | 1 | 0 | 0 | 0 | 0.0% |
| cache-import-fix | 1 | 0 | 1 | 0 | 0 | 0 | 0.0% |

Worst source families by (partial+mismatch) share of comparable rows (≥100 rows):
| source family | comparable | partial+mismatch | share |
|---|---|---|---|
| generation-baseline | 1,204 | 1,028 | 85.4% |
| catalog-gap-fill | 1,045 | 881 | 84.3% |
| oem_specs | 142 | 116 | 81.7% |
| manual-research | 1,146 | 927 | 80.9% |
| api_import | 2,396 | 1,828 | 76.3% |
| final-gap-fill | 110 | 81 | 73.6% |
| cache-import | 6,891 | 4,708 | 68.3% |
| generation | 247 | 164 | 66.4% |
| cleanup_cache-import | 143 | 92 | 64.3% |
| generation_template | 1,780 | 1,122 | 63.0% |

## Top 30 models by mismatched/partial rows
| make | model | rows | match | partial | mismatch | bad % |
|---|---|---|---|---|---|---|
| porsche | 911 | 246 | 25 | 213 | 8 | 89.8% |
| ram | 3500 | 332 | 134 | 74 | 124 | 59.6% |
| nissan | titan | 257 | 38 | 164 | 31 | 75.9% |
| ford | expedition | 211 | 43 | 160 | 8 | 79.6% |
| mercedes | c-class | 190 | 24 | 95 | 71 | 87.4% |
| jeep | grand-cherokee | 413 | 259 | 68 | 86 | 37.3% |
| mercedes | e-class | 177 | 21 | 60 | 92 | 85.9% |
| bmw | 3-series | 186 | 35 | 100 | 51 | 81.2% |
| mercedes-benz | e-class | 230 | 75 | 47 | 104 | 65.7% |
| bmw | 5-series | 179 | 29 | 84 | 64 | 82.7% |
| mercedes-benz | s-class | 213 | 69 | 46 | 96 | 66.7% |
| chevrolet | express-3500 | 139 | 0 | 138 | 1 | 100% |
| gmc | savana-3500 | 135 | 0 | 135 | 0 | 100% |
| gmc | sierra-2500hd | 154 | 20 | 85 | 49 | 87% |
| subaru | forester | 203 | 69 | 134 | 0 | 66% |
| subaru | outback | 236 | 70 | 131 | 0 | 55.5% |
| lexus | es | 180 | 46 | 109 | 20 | 71.7% |
| subaru | impreza | 141 | 16 | 123 | 2 | 88.7% |
| porsche | boxster | 145 | 15 | 85 | 40 | 86.2% |
| kia | sportage | 155 | 32 | 120 | 1 | 78.1% |
| gmc | sierra-3500hd | 130 | 12 | 106 | 12 | 90.8% |
| chevrolet | silverado-2500hd | 145 | 29 | 75 | 41 | 80% |
| mitsubishi | eclipse | 115 | 0 | 115 | 0 | 100% |
| chevrolet | express-2500 | 112 | 0 | 96 | 16 | 100% |
| mitsubishi | lancer | 112 | 0 | 112 | 0 | 100% |
| porsche | panamera | 128 | 16 | 112 | 0 | 87.5% |
| hyundai | tucson | 136 | 23 | 112 | 0 | 82.4% |
| chevrolet | colorado | 138 | 14 | 96 | 16 | 81.2% |
| volvo | s60 | 120 | 10 | 110 | 0 | 91.7% |
| gmc | savana-2500 | 108 | 0 | 88 | 20 | 100% |

Full list: `pass2/models-mismatch-ranked.csv`; row detail: `pass2/rows-mismatch.csv`, `pass2/rows-partial.csv`.

## Missing OE sizes (USAF size present in none of our trims for that Y/M/M)
**9,808** missing (Y/M/M, size) pairs across **4,710** Y/M/M — evidence of missing trims/packages (or of USAF listing optional/dealer sizes; verify against OEM before adding). Top 30 models:
| make | model | Y/M/M affected | missing sizes | years | sample sizes |
|---|---|---|---|---|---|
| bmw | 3-series | 33 | 121 | 1991-2026 | 205/55R15 195/65R14 225/55R15 235/40R17 225/45R17 245/40R17 |
| mercedes | e-class-coupe | 14 | 107 | 2009-2023 | 245/45R17 265/35R18 235/45R17 255/40R17 235/40R18 255/35R18 |
| mercedes | e-class | 32 | 104 | 1994-2026 | 205/60R15 235/45R17 275/35R18 215/55R16 265/35R18 255/40R17 |
| mercedes-benz | e-class-coupe | 13 | 101 | 2010-2023 | 245/45R17 245/40R18 265/35R18 235/45R17 255/40R17 235/40R18 |
| mercedes | e-class-cabriolet | 14 | 100 | 2009-2023 | 245/45R17 265/35R18 235/45R17 255/40R17 235/40R18 255/35R18 |
| mercedes-benz | c-class | 25 | 99 | 2000-2026 | 225/45R17 245/40R17 195/65R15 205/60R15 205/55R16 225/50R16 |
| bmw | 5-series | 27 | 97 | 1997-2026 | 225/60R15 255/40R17 235/45R17 235/40R18 265/35R18 255/40R19 |
| mercedes | c-class-amg | 18 | 95 | 2008-2026 | 235/35R19 255/30R19 255/35R19 285/30R19 265/35R19 235/40R18 |
| ford | f-150 | 26 | 93 | 1990-2026 | 215/75R15 265/75R15 275/60R17 245/75R16 265/70R17 255/70R16 |
| mercedes-benz | e-class-cabriolet | 12 | 90 | 2011-2023 | 245/45R17 245/40R18 265/35R18 235/45R17 255/40R17 235/40R18 |
| mercedes-benz | e-class | 27 | 88 | 1994-2026 | 225/55R16 245/40R18 275/35R18 235/45R17 215/55R16 255/40R17 |
| mercedes | c-class | 25 | 84 | 1995-2026 | 245/40R17 245/35R18 235/35R19 235/40R18 255/35R19 285/30R19 |
| mercedes-benz | s-class | 26 | 84 | 2000-2026 | 225/55R17 275/40R18 245/45R18 225/60R16 265/40R18 245/40R19 |
| porsche | 911 | 31 | 84 | 1994-2026 | 225/40R18 265/35R18 285/30R18 205/50R17 255/40R17 315/30R18 |
| mercedes | s-class | 27 | 83 | 1999-2026 | 235/60R16 225/60R16 265/40R18 245/45R18 225/55R17 245/40R19 |
| porsche | boxster | 21 | 82 | 2000-2025 | 205/55R16 225/50R16 205/50R17 225/40R18 265/35R18 225/45R17 |
| bmw | x5-m | 17 | 78 | 2009-2026 | 255/55R18 255/50R19 275/40R20 315/35R20 285/35R21 325/30R21 |
| chevrolet | silverado | 13 | 70 | 1999-2026 | 235/75R16 255/70R16 245/75R16 235/75R15 255/70R17 265/65R18 |
| porsche | cayenne | 16 | 69 | 2003-2026 | 255/55R18 275/45R19 275/40R20 235/60R18 255/50R19 265/50R19 |
| bmw | x6-m | 17 | 66 | 2009-2026 | 255/50R19 275/40R20 315/35R20 285/35R21 325/30R21 275/45R20 |
| ford | mustang | 32 | 66 | 1990-2026 | 195/75R14 225/60R15 225/55R16 205/65R15 245/45R17 255/45R17 |
| ford | mustang-shelby-gt500 | 12 | 65 | 2007-2023 | 235/55R17 235/50R18 215/65R16 215/60R17 245/45R19 255/45R18 |
| mercedes-benz | e-class-amg | 21 | 65 | 2002-2025 | 245/40R18 275/35R18 265/35R18 255/40R18 285/35R18 255/35R19 |
| mercedes | amg-gt | 9 | 64 | 2017-2026 | 295/30R19 255/45R19 285/40R19 265/40R20 295/35R20 275/35R21 |
| mercedes | gle-class-coupe | 10 | 64 | 2016-2026 | 255/50R19 265/45R20 295/35R21 285/40R22 325/35R22 275/45R21 |
| gmc | sierra-2500hd | 28 | 61 | 1990-2026 | 225/75R16 245/75R16 265/60R20 265/70R18 245/75R17 265/70R17 |
| mercedes | slk-class | 17 | 58 | 2000-2016 | 225/50R16 245/40R17 225/40R18 245/35R18 235/40R18 255/35R18 |
| mercedes | cls-class | 17 | 56 | 2006-2023 | 275/35R18 255/40R18 285/35R18 285/30R19 245/40R19 275/35R19 |
| mercedes | sl-class | 19 | 56 | 2000-2020 | 245/45R17 245/40R18 275/35R18 285/35R18 255/45R17 255/35R19 |
| mercedes | sl-class-amg | 19 | 55 | 2003-2025 | 285/35R18 255/35R19 285/30R19 265/35R19 325/30R20 265/40R20 |

Full list: `pass2/ymm-missing-oe-sizes.csv`, `pass2/models-missing-oe-ranked.csv`.

## Y/M/M with no USAF match (1,009 Y/M/M, 344 make+model)
`other_years_matched = true` means the same make+model DID match USAF in other years → the unmatched year is a **phantom-year candidate** (USAF has no such vehicle that year) rather than a naming problem. `false` → naming miss or model absent from USAF entirely (check `tried` in `ymm-usaf-unmatched.csv`). Top 40 by rows:
| make | model | Y/M/M | rows | years | other years matched |
|---|---|---|---|---|---|
| ford | f-450-super-duty | 26 | 70 | 2000-2026 | no |
| mini | clubman | 10 | 58 | 2008-2026 | yes |
| infiniti | qx50 | 7 | 42 | 2008-2026 | yes |
| infiniti | qx80 | 10 | 40 | 2004-2013 | yes |
| jaguar | xe | 7 | 35 | 2015-2025 | yes |
| subaru | outback | 5 | 35 | 1995-1999 | yes |
| volkswagen | gti | 15 | 33 | 1990-2005 | yes |
| volkswagen | golf | 8 | 32 | 2007-2026 | yes |
| nissan | titan | 2 | 24 | 2025-2026 | yes |
| chevrolet | tahoe | 3 | 21 | 1992-1994 | yes |
| chrysler | pacifica | 10 | 20 | 2016-2026 | yes |
| nissan | maxima | 4 | 19 | 2015-2026 | yes |
| bmw | m5 | 10 | 18 | 1990-2024 | yes |
| land rover | defender | 18 | 18 | 2000-2019 | yes |
| nissan | gt-r | 3 | 18 | 2022-2026 | yes |
| subaru | crosstrek | 3 | 18 | 2013-2015 | yes |
| bmw | m3 | 8 | 17 | 1992-2020 | yes |
| audi | a3 | 12 | 16 | 1996-2021 | yes |
| chrysler | 300 | 4 | 16 | 2004-2026 | yes |
| ford | fiesta | 16 | 16 | 2000-2024 | yes |
| mazda | cx-9 | 4 | 16 | 2006-2026 | yes |
| audi | tt-s | 15 | 15 | 2008-2023 | no |
| jeep | renegade | 3 | 15 | 2024-2026 | yes |
| mitsubishi | montero | 14 | 14 | 2007-2021 | yes |
| acura | tlx | 2 | 12 | 2014-2026 | yes |
| buick | regal | 12 | 12 | 2005-2026 | yes |
| chevrolet | colorado | 2 | 12 | 2013-2014 | yes |
| honda | ridgeline | 2 | 12 | 2015-2016 | yes |
| hyundai | santa-fe-classic | 6 | 12 | 2007-2012 | no |
| jaguar | xj | 4 | 12 | 2010-2022 | yes |
| jeep | cherokee | 12 | 12 | 2002-2013 | yes |
| mercedes | a-class-amg | 11 | 12 | 2013-2026 | yes |
| mini | countryman | 2 | 12 | 2025-2026 | yes |
| ford | ranger | 6 | 11 | 2012-2017 | yes |
| maserati | granturismo | 5 | 11 | 2007-2023 | yes |
| audi | s4 | 3 | 10 | 2003-2026 | yes |
| chrysler | voyager | 10 | 10 | 1990-1999 | no |
| infiniti | q50 | 2 | 10 | 2025-2026 | yes |
| infiniti | qx60 | 2 | 10 | 2013-2021 | yes |
| kia | forte | 2 | 10 | 2025-2026 | yes |

Full list: `pass2/models-usaf-unmatched-ranked.csv`, `pass2/ymm-usaf-unmatched.csv`.

## Notable findings observed while matching names
- **USAF model years are precise** (no 2014 BMW M4, 2005 M6, 2013 i8, 2002 Z4, 2013–14 Colorado, 2020+ LaCrosse, 2001 Escalade, 2012–18 Ranger, 2011–19 Fiesta only …). Most `usaf_missing_ymm` with `other_years_matched=yes` are therefore phantom model years in our table, not naming misses.
- **`ram | 1500/2500/3500` rows for 1994–2010** (346 rows) are Dodge-era trucks stored under make `ram` (Ram became a make in 2011). Pass 2 matched them via cross-make lookup (`Dodge | Ram 1500 …`) so their sizes are compared, but the make slug itself needs a Pass 0/1 fix.
- **Chrysler Voyager 1990–1999** rows exist under Chrysler (Plymouth-era) — USAF has Chrysler Voyager 2000+ only.
- USAF splits **2005–2010 Dodge Rams by trim** (`Ram 1500 Laramie/SLT/ST/Sport/TRX4/SRT-10`) and **Audi by drivetrain/body** (`A4 Quattro`, `A5 Sportback`, `RS6 Avant`); GM 1990s trucks are `C1500/K1500/K1500 Suburban`; Land Rover Discovery 2005–2016 is `LR3/LR4`.
- Confirmed **USAF catalog gaps** (all name variants fail, all years): Ford F-450 Super Duty, Chrysler Pacifica 2017+, Hummer H1 (only via make `AM General`), most exotics pre-2015.
- Family slugs (`bmw 3-series`, `mercedes c-class`, `lexus es`) whose rows carry only `Base` trims were matched via year-gated variant tables in `lib.mjs` (`BMW_VARIANTS`, `LEXUS_VARIANTS`, `MB_VARIANTS`) — their `missing_oe` lists are the strongest evidence of missing variant trims.

## Prioritized parent-apply list (flags only — nothing applied)
1. **Row-level `mismatch` (3,866 rows, `rows-mismatch.csv`)** — none of our sizes exist for that Y/M/M per USAF. Highest-confidence wrong data. Suggested: set `certification_status='flagged'` with reason `pass2:mismatch`; where `rim_overlap=false` (no shared rim diameter) also consider quarantine pending OEM check. Where `trim_status='mismatch'` (USAF has a trim-level name) the row is wrong at trim level, not just model level.
2. **Row-level `partial` (12,206 rows, `rows-partial.csv`)** — row lists extra sizes USAF does not have for the Y/M/M (`ours_not_in_usaf`). Typical cause: "Base" rows that union every size of the generation. Suggested: flag; drop `ours_not_in_usaf` sizes after OEM check.
3. **Missing OE sizes (4,710 Y/M/M, `ymm-missing-oe-sizes.csv`)** — USAF lists sizes we don't carry anywhere for the Y/M/M → probable missing trim/package (feeds Pass 1 trim-gap list). Suggested: add trims from OEM/EPA lists, not blindly from USAF.
4. **Unmatched Y/M/M with `other_years_matched=yes` (`models-usaf-unmatched-ranked.csv`)** — phantom-year candidates; cross-check with Pass 1 NHTSA result before quarantining.
5. **Unmatched make+model with `other_years_matched=no`** — add to `MODEL_OVERRIDES` in `lib.mjs` if it is a naming miss and re-run 01 (cache makes it cheap); otherwise USAF simply lacks the model (exotics, pre-1995, EVs newer than USAF's catalog).
6. **`match` rows (15,996)** — eligible for `tire_verified` in the final certification script (source reference: `usaf:GetVehicleOptions`, models in `audit_pass2_results.usaf_models`). Note this verifies sizes at Y/M/M granularity only; a row can be `match` while assigned to the wrong trim.

## Re-run
```
node --env-file=.env.local scripts/audit/pass2/01-fetch-usaf.mjs            # resumable; add --load-only to just (re)load audit_pass2_usaf_sizes/unmatched from cache
node --env-file=.env.local scripts/audit/pass2/02-compare.mjs               # offline, deterministic
node scripts/audit/pass2/03-doc.mjs                                         # this document
```
