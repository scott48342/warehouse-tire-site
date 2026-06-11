# Full Fitment Coverage Audit Report

**Date:** 2026-06-10
**Scope:** All certified records in `vehicle_fitments` (`certification_status='certified'`)
**Mode:** READ-ONLY — no data was modified
**Method:** Equivalence-class probing — product availability depends only on search inputs, so the 36,674 vehicles were reduced to 595 distinct modern tire sizes, 532 wheel classes (bolt pattern × diameter set), and 460 package probes against production APIs (`shop.warehousetiredirect.com`), then joined back to every vehicle record.

## Headline

| Metric | Value |
|---|---|
| Total certified vehicles audited | **36,674** |
| Full coverage (tires + wheels + packages) | **26,131 (71.3%)** |
| Full coverage (tires + wheels, package gap) | 3,286 (9.0%) |
| Category A combined (tires>0 AND wheels>0) | **29,417 (80.2%)** |

## Classification

| Cat | Definition | Count | % |
|---|---|---|---|
| **A** | Tires > 0 AND wheels > 0 | **29,417** | **80.2%** |
| ↳ A with packages | …AND packages > 0 | 26,131 | 71.3% |
| ↳ A without packages | …AND packages = 0 ("package gap") | 3,286 | 9.0% |
| **B** | Tire only (tires > 0, wheels = 0) | **2,338** | **6.4%** |
| **C** | Wheel only (wheels > 0, tires = 0) | **4,534** | **12.4%** |
| **D** | Fitment exists, no products at all | **375** | **1.0%** |
| **E** | Lookup failure (cannot resolve) | **10** | **0.03%** |

## Root Causes (ranked)

| # | Root Cause | Vehicles | Notes |
|---|---|---|---|
| 1 | `vintage_tire_size` | 4,314 | Classic vehicles with bias-ply era sizes (F70-14, G78-15…) — suppliers don't carry these; **expected, not a bug** |
| 2 | `package_generation_gap` | 3,286 | Tires AND wheels available but `/api/packages/recommended` returns 0 — **code-path issue, highest-value fix** (see separate investigation) |
| 3 | `missing_inventory_wheels` | 2,315 | Valid bolt/diameter but no wheels in supplier inventory (rare bolt patterns, very small/large diameters) |
| 4 | `missing_oem_tire_size` | 571 | Record has no OEM tire sizes at all |
| 5 | `missing_inventory_tires` | 24 | Modern size, but no supplier stock |
| 6 | `missing_wheel_sizes` | 23 | No parseable OEM wheel diameters in record |
| 7 | `missing_bolt_pattern` | 10 | No bolt pattern AND no tire sizes — unresolvable |

**Key insight:** Of the 7,257 non-A vehicles, **59%** (4,314) are vintage vehicles that no supplier can serve — the *addressable* gap is ~2,933 vehicles (B/C/D with modern sizes) plus the 3,286 package-gap vehicles inside category A.

## Top Failure Makes

| Make | Failures | | Make | Failures |
|---|---|---|---|---|
| Chevrolet | 1,193 | | Pontiac | 301 |
| Ford | 1,088 | | Cadillac | 297 |
| GMC | 607 | | Buick | 252 |
| BMW | 506 | | Lexus | 201 |
| RAM | 415 | | Audi | 196 |

(Chevrolet/Ford/Pontiac/Buick counts are heavily inflated by vintage records — Corvette 171, Firebird 165, Regal 83, Impala 80.)

## Top Failure Models

RAM 2500 (206), RAM 3500 (183), Ford F-150 (175), Corvette (171), Firebird (165), Silverado 2500HD (141), Sierra 2500HD (134), Yukon (115), Ford F-350 (114), Sierra 3500HD (107), Camaro (105), Audi Q5 (103), Silverado 3500HD (101), BMW X3 (95), BMW 3 Series (87).

## Revenue Impact (2015+ vehicles, highest affected counts)

| Vehicle | Affected | Categories | Concern |
|---|---|---|---|
| Chevrolet Silverado 2500HD | 72 | C, D | HD trucks — high AOV wheel/tire buyers |
| RAM 2500 | 70 | C, D, B | HD trucks |
| BMW X3 | 67 | B, C | Volume luxury CUV |
| GMC Sierra 2500HD | 67 | D, C | HD trucks |
| Audi Q5 | 66 | B | Volume luxury CUV — wheels return 0 |
| RAM 3500 | 63 | C, D | HD trucks |
| Silverado 3500HD | 62 | C | HD trucks |
| Ford F-150 | 61 | B | **Best-selling truck in America** — wheel search returns 0 for these trims |
| Ford F-350 | 60 | C, D | HD trucks |
| Mercedes GLC | 58 | B | Volume luxury |

**Pattern:** Recent HD trucks (2500/3500 series) cluster in C/D — their OEM tire sizes (e.g., LT-metric flotation sizes on 17/18" wheels with 8-lug patterns) lack tire inventory, and some lack wheel inventory. Volume luxury CUVs (X3, Q5, GLC, C-Class) cluster in B — wheel searches return 0, likely diameter/offset window too narrow or inventory gaps in their bolt patterns.

## Probe Statistics

| Probe | Total | With Results | Hit Rate |
|---|---|---|---|
| Tire sizes | 595 | 545 | 92% |
| Wheel classes | 532 | 460 | 86% |
| Package classes | 460 | 380 | 83% |

## Deliverables

- `scripts/coverage-audit/full-coverage.csv` — Category A (29,417)
- `scripts/coverage-audit/tire-only.csv` — Category B (2,338)
- `scripts/coverage-audit/wheel-only.csv` — Category C (4,534)
- `scripts/coverage-audit/no-products.csv` — Category D (375)
- `scripts/coverage-audit/lookup-failures.csv` — Category E (10)
- `scripts/coverage-audit/failure-analysis.csv` — All failures + package-gap rows with root causes
- `scripts/coverage-audit/audit-results.json` — Full per-vehicle data (36,674 rows)
- `scripts/coverage-audit/summary.json` — Summary statistics

## Recommended Priorities

1. **Package generation gap (3,286 vehicles)** — pure code issue; products exist. Single highest-value fix. → see `scripts/PACKAGE-GAP-INVESTIGATION.md`
2. **HD truck tire inventory (C-category trucks)** — verify LT/flotation size search handles these sizes correctly vs. a true inventory gap; RAM/GM/Ford HD = high AOV
3. **Luxury CUV wheel gap (B-category)** — X3/Q5/GLC wheel searches return 0; check diameter windows and bolt-pattern inventory (5x112, 5x108)
4. **571 records missing OEM tire sizes** — data backfill candidates
5. **Vintage vehicles (4,314)** — accept as out of scope, or hide product CTAs for these to avoid dead-end UX

## Caveats

- Wheel/package results measured per equivalence-class representative; per-vehicle counts inherit from the class rep. Trim-level edge cases inside a class may vary slightly.
- "Tire available" = any of the vehicle's modern tire sizes returns supplier results (size-level probe).
- Production APIs probed 2026-06-10 12:10–12:48 EDT; inventory fluctuates daily.
- Audit ran immediately after the P0 make-normalization deploy, so multi-word makes (Land Rover, Alfa Romeo, etc.) are correctly included.
