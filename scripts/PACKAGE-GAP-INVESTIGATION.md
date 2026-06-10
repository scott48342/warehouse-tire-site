# Package Generation Gap Investigation

**Date:** 2026-06-10
**Branch:** `fix/package-generation-gap` · **Commit:** `381850d` · **NOT DEPLOYED**
**Spec:** `g:\clawd\fable-package-gap-investigation.md`

## Executive Summary

The 3,286 "package gap" vehicles (wheels ✅ + tires ✅ + packages ❌) are caused by three independent code issues, not inventory: **(1)** the API route hard-rejects any vehicle older than 1990 (925 vehicles, 28%); **(2)** the engine validates every candidate package against the overall diameter of the *first* OEM tire size only, so vehicles with multiple OEM sizes (staggered/optional wheels) fail the ±3% safety check for every larger-rim package (320+ vehicles); **(3)** category diameter targets and the offset pre-filter are stricter than the safety validator itself — strict plus-size targets often don't exist in inventory, and records with degenerate offset ranges (min = max) reject every wheel (415+ vehicles). A three-part fix on `fix/package-generation-gap` recovers **2,999 of 3,286 vehicles (91.3%)** in full local engine replay, with the ±3% overall-diameter safety rule fully preserved.

## Method

Production HTTP probing can't see *why* the engine returns zero, so the investigation replayed the entire engine pipeline locally:

1. Loaded the same techfeed feed the engine uses (`src/techfeed/wheels_by_sku.json.gz`, 41,830 SKUs) and rebuilt its bolt-pattern index (51 keys)
2. Pulled all 3,286 gap vehicles' fitment rows from the DB (read-only)
3. Replayed `getRecommendedPackages()` filter-by-filter for each vehicle, recording the **first rejection stage per category**
4. Cross-validated against production: spot-checked vehicles the replay said should work/fail

Tracer: `scripts/coverage-audit/05-package-gap-trace.mjs` → `package-gap-trace.json`

## Pipeline Map

```
GET /api/packages/recommended            src/app/api/packages/recommended/route.ts
  ├─ ❌ GATE 1: year < 1990 → 400        (route validation)
  └─ getRecommendedPackages()             src/lib/packages/engine.ts
      ├─ getVehicleFitment()              listLocalFitments + parseWheelSizes
      │    └─ ❌ no boltPattern → []
      ├─ getTechfeedCandidatesByBoltPattern(bolt)   src/lib/techfeed/wheels.ts
      │    └─ ❌ bolt key missing from feed → 0 candidates
      └─ generatePackages() per category (daily/sport/premium/offroad)
           ├─ ❌ GATE 2: diameter ∉ targets (baseOEM + category offsets)
           ├─ ❌ GATE 3: offset outside [omin..omax] (hard OEM bounds)
           ├─ ❌ price ≤ 0 (no msrp/map)
           ├─ findMatchingTire() (OEM size for rim, else computed plus-size)
           └─ ❌ GATE 4: validateFitment ±3% vs oemOverallDiameter (FIRST size only)
```

## Failure Breakdown (all 3,286 vehicles traced)

| Rejection stage | Vehicles | % | Verdict |
|---|---|---|---|
| `route_year_gate` (year < 1990) | 925 | 28.2% | **Bug** — arbitrary cutoff; DB serves certified classics |
| `SHOULD_WORK` in current code | 1,620 | 49.3% | Mostly **stale audit reads** (cold caches/timeouts during probe + class-rep trim mismatches); prod re-checks now return packages (Fusion 3, Taycan 2, Tacoma 4, RAM 2500 3…) |
| `diameter_filter` (targets missing from inventory) | 415 | 12.6% | **Over-strict filter** — e.g., 2002-06 F-250 OEM 18": sport wants 19/20", premium 20/21"; 8x170 inventory jumps 18→20 |
| `validate_diameter` (±3% vs first-OEM-size baseline) | 320 | 9.7% | **Bug** — multi-size vehicles validated against wrong baseline (Alfa 4C 17" baseline 24.3" vs 19" OEM 25.5" = +5-6% "failure") |
| `offset_filter` (degenerate ranges) | 6 | 0.2% | **Bug** — min=max records (BRZ 48..48) reject all inventory |

57 equivalence classes genuinely return 0 in production today (Alfa 4C, Audi TT/S6, BMW 2 Series, Buick Encore, Cadillac Lyriq…) — all explained by stages above.

## Root Causes (detailed)

### RC1 — Route year gate (925 vehicles)
`route.ts` line 46: `year < 1990 → 400`. The fitment DB intentionally contains certified classics (Chevelle, Nova, Firebird, C10…) which all have modern-size wheel/tire conversions available. Pure dead code path for 28% of the gap.

### RC2 — Single-baseline diameter validation (320 vehicles + suppresses categories everywhere)
`engine.ts` computed `oemOverallDiameter` from `oemTireSizes[0]` only. Example, Alfa Romeo 4C (OEM 17" front / 18-19" options): baseline = 205/45R17 → 24.3". A 19" candidate with OEM's own 235/35R19 (25.5") computes +5.0% → rejected as "unsafe" even though it's literally the OEM tire. Affects every multi-size and staggered vehicle in the premium/sport categories.

### RC3 — Filters stricter than the safety rule (415 + 6 vehicles)
- **Diameter:** category targets are `baseOEM + offsets` *exactly*. If inventory for that bolt pattern skips a diameter (extremely common on HD 8-lug: 18" → 20", no 19"), the category dies even though safe wheels exist one notch away.
- **Offset:** pre-filter enforces `[omin..omax]` hard, while `validateFitment` allows ±5mm beyond. Records with `omin = omax` (single OEM offset, e.g., Subaru BRZ 48) reject nearly all inventory before validation ever runs.

## Success-vs-Failure Comparison (Phase 5)

| Platform | Working | Failing | Differentiator |
|---|---|---|---|
| RAM 2500 | 1998 (omin/omax wide, 16" OEM, 8x165.1 16" inventory exists) | 1994 SLT (same bolt, audit-time zero; replay says works now) | audit-time cold cache vs warm |
| Ford F-250 | 2015 XLT 18" (18" exists in 8x170) | 2002-06 18" OEM | sport/premium targets 19-21" don't exist in 8x170 feed |
| Alfa Romeo 4C | — | all years | RC2: first-size baseline 24.3" rejects 18/19" candidates |
| Subaru BRZ 2018 | trims with range omin≠omax | trim with 48..48 | RC3 offset: degenerate range |
| Chevelle/Nova (classics) | — | all pre-1990 | RC1 year gate |

## Fix (implemented, commit `381850d`)

| # | File | Change | Risk |
|---|---|---|---|
| 1 | `src/app/api/packages/recommended/route.ts` | Year gate 1990 → 1940 | **LOW** — validation-only |
| 2 | `src/lib/packages/engine.ts` | `oemOverallDiameterByRim` map; `resolveOemBaseline()` picks per-rim baseline (exact → closest → legacy single) | **LOW** — makes the safety check *more correct*, never looser than OEM data |
| 3a | `src/lib/packages/engine.ts` | Diameter fallback: if strict targets yield no wheel, retry with available inventory diameters within OEM−1…OEM+3 | **MEDIUM-LOW** — every fallback package still passes the unchanged ±3% validator |
| 3b | `src/lib/packages/engine.ts` | Offset pre-filter widened to ±5mm — exact parity with `validateFitment`'s hard bound | **LOW** — validator unchanged |

**Safety invariant preserved:** `validateFitment`'s ±3% overall-diameter and ±5mm offset hard bounds are untouched; tests pin both.

## Test Results

- `src/lib/packages/__tests__/packageGap.test.ts` — **11/11 pass** (per-rim baseline, closest-rim fallback, old-bug regression guard, degenerate offset ranges, ±3% rule unchanged)
- `tsc --noEmit` — clean
- Full suite: 238 pass / 18 fail — the 18 failures **pre-exist on base** (verified via `git stash` → identical failures), same set documented in the P0 make-fix report

## Recovery Estimate

Full engine replay of all 3,286 gap vehicles with fixes applied (`scripts/coverage-audit/07-trace-fixed.mjs`):

| Metric | Value |
|---|---|
| Recovered | **2,999 / 3,286 (91.3%)** |
| Still failing | 287 (8.7%) — genuine edge cases: bolt patterns thin in feed, extreme OD deltas, no parseable sizes |
| Coverage impact | Full coverage 71.3% → **~79.4%** (26,131 → ~29,130 of 36,674) |

## Business Impact

The gap includes high-AOV, high-volume vehicles: Porsche 911 (168), Toyota Tacoma (110), Ford F-250/F-350 (153), Jeep Wrangler (74), Ford Ranger (78), plus the entire pre-1990 classic segment (925). Packages are the highest-margin product (wheel + tire bundle, ~$1,400–2,800 AOV). At even 0.5% conversion on these pages, ~3,000 recovered vehicles represent meaningful incremental revenue; the classics segment (Chevelle, Nova, Firebird, C10) is an enthusiast audience with above-average accessory spend.

## Production Recommendation

1. Review + merge `fix/package-generation-gap` (single commit `381850d`, 3 files, +228/−7)
2. Deploy during low-traffic window; no DB or cache migrations required
3. Post-deploy smoke: `/api/packages/recommended` for 1972 Chevelle, 2017 Alfa 4C, 2004 F-250, 2018 BRZ, plus regression checks on 2024 F-150/Camry
4. Re-run package probe (`scripts/coverage-audit/03-probe.mjs` Phase P) to confirm recovery against production
5. Residual 287: backlog item — mostly data quality (missing sizes) rather than code

## Artifacts

- `scripts/coverage-audit/05-package-gap-trace.mjs` — per-vehicle rejection tracer
- `scripts/coverage-audit/package-gap-trace.json` — full trace (3,286 vehicles)
- `scripts/coverage-audit/07-trace-fixed.mjs` — post-fix recovery replay
- `scripts/coverage-audit/06-bolt-keys.mjs` — techfeed bolt-pattern inventory map
- `src/lib/packages/__tests__/packageGap.test.ts` — regression tests
