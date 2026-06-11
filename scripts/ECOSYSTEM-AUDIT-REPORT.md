# Vehicle Fitment Ecosystem — End-to-End Audit Report

**Date:** 2026-06-10 · **Mode:** Read-only (no data modified, no migrations run, no deploys)
**Project:** `warehouse-tire-site` · **DB:** Neon Postgres (`vehicle_fitments`, 37,495 rows)
**Evidence files:** `scripts/ecosystem-audit-db.json`, `scripts/ecosystem-audit-resolver-test.json`
**Audit scripts:** `scripts/ecosystem-audit-queries.mjs`, `scripts/ecosystem-audit-resolver-test.mjs` (both read-only)

---

## Executive Summary

The core pipeline (selector → fitment → tire/wheel search) is architecturally sound, with layered caching, coverage-validated selectors, and a guarded resolver. **But the audit found one P0-class defect:** the make-normalization layer (`makeAliases.ts`) canonicalizes multi-word makes to **hyphenated slugs** ("Land Rover" → `land-rover`) while the database stores **spaced, proper-cased values** ("Land Rover"), and the resolver compares with case-insensitive *equality*. Result: **~2,400 certified records are unreachable through any code path that routes through `normalizeMake()`** — including Mercedes-Benz (1,591 certified records), Land Rover (627), Alfa Romeo (119), and Aston Martin (40).

Second finding of note: the **runtime already defends against the May-7 2018 import mess** — the 652 deprecated staggered-split rows are stamped `certification_status='deprecated-superseded-by-canonical'` and `safeResolver` only serves `certified` rows. However, **not all query paths apply the certified filter** (e.g., `coverage.ts` selector queries), so selectors can offer trims that the resolver then refuses — a "trim shown → no fitment found" trap.

---

## PHASE 1 — Architecture Discovery

### Text architecture diagram

```
CUSTOMER
  │
  ├─ YMM Selector UI (SteppedVehicleSelector, VisualFitmentLauncher)
  │    └─ /api/vehicles/years|makes|models|trims     ← coverage-validated, Redis-cached
  │         └─ src/lib/fitment-db/coverage.ts, ymmCache.ts, canonicalResolver, trimExplosion
  │
  ├─ Fitment Resolution
  │    └─ /api/fitment/*, /api/vehicles/tire-sizes
  │         └─ src/lib/fitment-db/safeResolver.ts    ← CERTIFIED_FILTER, fallback chain
  │         └─ src/lib/fitment-db/profileService.ts  ← getFitmentProfile(+HdSupport)
  │         └─ modelAliases.ts (variants), makeAliases.ts (canonicalMake/displayMake)
  │         └─ applyOverrides.ts, vehicleFitmentRules.ts (rule overrides)
  │
  ├─ Tire Search:  /api/tires/search ───────────────── TireWeb (ATD/NTW/K&M) + USAF direct
  │                                                    + WheelPros tires; MAP floor; spec enrichment
  ├─ Wheel Search: /api/wheels/fitment-search ──────── WheelPros products + inventory filter
  │                                                    + hd-templates (DRW), guidance badges
  ├─ Packages:     /api/packages/recommended, /package/customize
  │                └─ src/lib/packages/*, oem-package-choices
  ├─ Jake AI:      /api/jake/chat
  │                └─ src/lib/jake/{index,systemPrompt,tools}.ts
  │                   tools: lookup_tire_sizes, lookup_wheel_fitment, list_trims,
  │                          search_wheels, search_tires (+ enthusiast platform detection)
  └─ Cart:         /api/cart/*, /api/ai/create-cart-link, Stripe/PayPal checkout
                   └─ supplier auto-order (WheelPros, USAF) post-payment
```

### Component map (key files)

| Component | Files | Data source | Failure points |
|---|---|---|---|
| YMM selectors | `api/vehicles/{years,makes,models,trims}/route.ts` | `vehicle_fitments` + Redis + static fallback | Stale Redis (3600s/86400s makes; 300/600s trims); fallback list drift |
| Make normalization | `lib/fitment/makeAliases.ts`, `lib/fitment-db/keys.ts` | hardcoded maps | **Slug-vs-DB mismatch (P0, below)** |
| Model aliases | `lib/fitment-db/modelAliases.ts` (19KB) | hardcoded | Unlisted variants fail |
| Resolver | `lib/fitment-db/safeResolver.ts` | DB w/ `CERTIFIED_FILTER` | ILIKE-equality on make (P0); ambiguity → not_found |
| Profile service | `lib/fitment-db/profileService.ts` (66KB) | DB | same make matching; sheer size = maintenance risk |
| Trims | `coverage.ts`, `canonicalResolver`, `trimExplosion` | DB | **No certified filter in coverage.ts** (P1) |
| Tire search | `api/tires/search/route.ts` (900+ lines) | TireWeb + USAF + WheelPros | supplier rate limits (circuit breaker exists); ≥4-stock price rule |
| Wheel search | `api/wheels/fitment-search/route.ts` (3,100+ lines) | profileService + WheelPros + SFTP inventory | missing bore/bolt → unsafe or empty; size of file |
| Packages | `lib/packages/*`, `api/packages/recommended` | fitment + both product APIs | inherits all upstream failures |
| Jake | `lib/jake/tools.ts` | internal APIs | free-text make/model → normalization (P0 multiplier) |

### Database dependencies
`vehicle_fitments` (fitment, 37,495), `tire_model_images`, `tire_pattern_specs`, `tire_map_cache`, `suspension_fitments`, `supplier_orders`, `admin_settings` + Upstash Redis (YMM/trims/tire-search caches) + WheelPros SFTP inventory feed.

---

## PHASE 2 — YMM Selector Audit

**Flow:** year → `/api/vehicles/makes?year=Y` → `displayMake()` dedupe → models → trims. All coverage-validated against the DB (good — no phantom offers), Redis-cached, static fallback for makes only.

**Findings:**

1. **Selector make list is built from raw DB distinct + `displayMake()`** — "Mercedes" and "Mercedes-Benz" both display as "Mercedes-Benz" and dedupe hides the storage split. Cosmetically fine, but masks the underlying reachability bug (Phase 3).
2. **2018-only make pollution (confirmed live):** 20 makes exist *only* in year 2018: `Chevrolet Minivans`, `Mercedes-Benz Vans`, `Toyota Minivans`, etc. (the malformed TGP makes), plus casing strays `Mini`/`Ram`/`Smart` vs canonical `MINI`/`RAM`/`smart`. A 2018 shopper sees **category-suffix garbage makes in the selector** until the cleanup migration runs. `Karma` is legitimately 2018-only (Revero) — keep.
3. **Caching:** makes cached 1h browser/24h CDN — a make fix can take a day to propagate unless Redis+CDN purged (already documented in migration plan).
4. **Trims dedupe + explosion logic** (`processTrims`) is solid — grouped-trim explosion ("LX, Sport, EX"), compact-slash preservation ("R/T"), premium-UX base-trim collapse. No issues found in code review.
5. **Empty-state handling:** all selector APIs return structured `no_coverage` rather than 500s. Good.

---

## PHASE 3 — Fitment Lookup Audit ⚠️ CRITICAL FINDING

### P0: `canonicalMake()` slugs don't match DB storage for multi-word makes

`keys.ts` re-exports `canonicalMake` as `normalizeMake`. `safeResolver`, `coverage.ts`, `getFitment.ts`, and `profileService.ts` all do:

```ts
const normalizedMake = normalizeMake(make);          // "Land Rover" → "land-rover"
...
ilike(vehicleFitments.make, normalizedMake)          // ILIKE 'land-rover' (no wildcards = exact, case-insensitive)
// or: sql`lower(make) = ${make.toLowerCase()}`      // 'land rover' vs DB... wait — see below
```

DB stores `"Land Rover"` (space). `'land rover' ILIKE 'land-rover'` → **false**. Measured against production data (certified rows only):

| Input | canonicalMake() | Reachable | Brand total | **Unreachable** |
|---|---|---|---|---|
| Mercedes-Benz / Mercedes | `mercedes` | 1,384 ("Mercedes" rows) | 2,975 | **1,591 ("Mercedes-Benz" rows)** |
| Land Rover | `land-rover` | **0** | 627 | **627** |
| Alfa Romeo | `alfa-romeo` | **0** | 119 | **119** |
| Aston Martin | `aston-martin` | **0** | 40 | **40** |
| RAM, MINI, Toyota, Ford, BMW, smart, Rolls-Royce | (single-word) | all | all | 0 |

**~2,400 certified records (≈6.4% of the DB) are unreachable via the resolver path**, spanning four luxury brands whose shoppers buy high-margin wheels. The "Rolls-Royce" case works only because the DB happens to store it hyphenated; "Land Rover"/"Alfa Romeo"/"Aston Martin" are stored with spaces.

**Caveat:** wheel/tire searches that route through `getFitmentProfileWithHdSupport` or rule overrides may have separate compensations, and `modelNormalizedMatch` uses wildcard patterns (model side is tolerant — it's the **make side** that's exact). I did not exercise the live HTTP APIs (server not running during audit); DB-level evidence is conclusive for every code path reading these four functions. **Recommend immediate live-API spot check:** `/api/vehicles/models?year=2024&make=Land Rover` and a Land Rover tire-sizes call.

**Fix (small, safe):** make the comparison slug-insensitive on both sides:
```ts
// makeCaseInsensitive() in coverage.ts / profileService.ts / safeResolver / getFitment:
sql`LOWER(REGEXP_REPLACE(${vehicleFitments.make}, '[^a-zA-Z0-9]+', '-', 'g')) = ${canonicalMake(make)}`
```
…or add the spaced variants to `MAKE_TO_CANONICAL` so canonical == DB storage ("land rover" → "land rover"). Longer-term: **normalize DB storage itself** (one make-canonicalization migration — extends the 2018 migration already staged).

### Other Phase-3 findings

- **Resolver fallback chain is well-designed:** exact modification → exact displayTrim → normalized trim → single-trim fallback; ambiguous = refuse + log (`unresolvedFitmentTracker.ts`, 24KB). No random guessing. Good.
- **CERTIFIED_FILTER (strict)** in safeResolver: only `certified` rows serve runtime. 36,674 certified / 652 deprecated / 169 needs_review. The 652 deprecated 2018 rows are **already invisible to the resolver** — production was protected even before the staged migration (which remains worthwhile: it removes selector pollution and dead weight).
- **Silent-failure path (P1):** `coverage.ts` (years/makes/models/trims) does **not** apply CERTIFIED_FILTER → selectors can offer "Base Front Base"-style trims from deprecated rows; the resolver then refuses → customer sees "no fitment data" after picking a trim that was offered. The 169 `needs_review` rows have the same trap.

---

## PHASE 4 — Tire Search Audit

Path: trim → `oem_tire_sizes` (or wheel-driven sizes when diameters selected, per FITMENT_DESIGN_RULES) → `/api/tires/search` → TireWeb + USAF parallel → merge/enrich → MAP floor → price.

- **Staggered:** merged records carry `{front:[], rear:[]}` objects; staggered-search endpoint exists (`/api/tires/staggered-search`). The merged-staggered 2018 rows have proper front/rear structure (verified in 2018 investigation).
- **Resilience:** circuit breaker + read-through Redis (30min) + stale-while-revalidate for TireWeb's ErrorCode-127 rate limits; supplier source tags; ≥4-stock price rule (2026-05-07) prevents unfulfillable low prices.
- **Risk:** size-string matching is `ILIKE` against supplier data (`tire_size ilike $2`) — OEM sizes stored as `LT245/75R17/E` style must agree with supplier formats; the `/E` load-range suffix is handled by alternates array (`$6::text[]`). Code accounts for it; no defect found in review.
- **Plus-sizing:** `/api/tires/plus-sizes` exists; not deeply traced (time-boxed).
- **Inherited P0:** any tire search keyed off vehicle → make normalization → Land Rover/Alfa Romeo customers get nothing.

## PHASE 5 — Wheel Search Audit

Path: vehicle → `getFitmentProfileWithHdSupport` → bolt/bore/offset window → WheelPros product search → SFTP inventory filter → grouping → guidance badges.

- **Missing bore (74 rows table-wide) / missing bolt (30 rows):** these can't safely sell wheels. Review-queue CSVs already generated (`scripts/migrations/review-queue/`). Recommendation (from migration work): exclude from wheel results until backfilled — **verify the API actually excludes them; not confirmed in this audit.** (P1 verification item.)
- **HD trucks:** dedicated `hd-templates.ts` (SRW/DRW bolt-pattern split, GM 8x210 DRW, offset filtering for Ford/Ram DRW) — sound design, previously validated.
- **Staggered wheels:** `isStaggered` flag from fitment-search; merged 2018 records expose structured per-axle widths — compatible.
- **Rule overrides** (`getFitmentFromRules`, line 3118) provide an escape hatch — also a place where stale hardcoded data can hide; periodic re-audit advised.

## PHASE 6 — Package Builder Audit

`/api/packages/recommended` + `package/customize` + `oem-package-choices` admin. Packages = fitment ∧ wheels ∧ tires, so they inherit every upstream defect; no *additional* systemic defect identified in review. Diameter-match logic (tire size ↔ wheel diameter) lives in package lib + `recommendations/tire-for-wheels`; the wheel-driven tire-size rule (2026-04-16) is the governing design. **Not exercised live** (requires running app) — flagged for the live test pass.

## PHASE 7 — Jake Audit

- Jake's tools require `year, make, model` (free text from conversation) → internal lookups → **the P0 make bug hits Jake hardest**, since customers type "Alfa Romeo" / "Land Rover" naturally. Jake then reports "I can't find your vehicle" — a *normalization* failure presenting as a *coverage* failure.
- `detectEnthusiastPlatform()` handles Camaro/Mustang/Mopar/trucks with "chevy" aliasing inline — but general make aliasing happens downstream in the shared path (good consistency, same shared bug).
- **Top predicted causes of Jake vehicle failures, ranked:**
  1. Multi-word make normalization (P0 above) — Mercedes-Benz/Land Rover/Alfa Romeo/Aston Martin
  2. Model nicknames absent from `modelAliases.ts` ("Vette", "Stang", "G-Wagon", "Bimmer")
  3. Trim ambiguity → safeResolver refuses ambiguous matches (correct but reads as failure to user)
  4. Vehicles genuinely missing (pre-2000, exotic, or the 169 needs_review rows)
- Jake analytics exist (`/api/admin/jake-analytics`, conversation drill-down) — **pull the actual "can't find vehicle" transcripts and diff against this list** (action item; analytics DB not queried in this audit).

## PHASE 8 — Test Matrix (DB-level; live HTTP not exercised — app not running)

| Vehicle | Records | Certified | Bolt | Bore | Verdict |
|---|---|---|---|---|---|
| 2024 Toyota Camry | 11 | 11 | ✓ | ✓ | ✅ healthy |
| 2024 Ford F-150 | 11 | 11 | ✓ | ✓ | ✅ healthy |
| 2020 Chevy Silverado 1500 | 1 | 1 | ✓ | ✓ | ✅ (thin: 1 trim) |
| 2018 Honda Accord | 9 | 9 | ✓ | ✓ | ✅ healthy |
| 2018 Jeep Wrangler | 8 | 8 | ✓ | ✓ | ✅ healthy |
| 2018 VW Golf R | 1 | 1 | ✓ | ✓ | ✅ healthy |
| 2018 Acura NSX | 3 | 1 | ✓ | ✓ | ⚠️ 2 deprecated rows pollute selectors (merged row serves) |
| 2018 Porsche 718 Cayman | 9 | 3 | ✓ | ✓ | ⚠️ 6 deprecated rows pollute selectors |
| 2018 Chevy Corvette | 9 | 3 | ✓ | ✓ | ⚠️ 6 deprecated rows pollute selectors |
| 2018 Alfa Romeo Giulia | 8 | 4 | ✓ | ✓ | 🔴 **P0: unreachable via resolver (make bug)** |
| 2018 BMW i3 | 7 | 3 | ✓ | ✓ | ⚠️ 4 deprecated rows pollute selectors |

**Pattern:** Every staggered 2018 vehicle still carries its deprecated Front/Rear rows (certified-filtered out of the *resolver*, but visible to *coverage/selector* queries — the Phase 3 silent-failure trap). Alfa Romeo Giulia is doubly broken: even its 4 certified records are unreachable because of the make-normalization P0.

**Edge cases:**
- Missing bore/bolt: 74 + 30 rows table-wide (review queue generated) — confirm wheel API exclusion behavior.
- Cleaned 2018 import: serves correctly via merged-staggered records where the make is single-word.
- Complex trims ("Ti w/Sport Pkg.", DRW + Snow Plow): resolver's normalized-trim matching handles punctuation; verified present and certified.

**⚠️ Live HTTP testing (selector → cart in browser, Jake conversations) was not possible in this audit window** (dev server not running). DB + code-path evidence stands; the P0 should be confirmed with one live API call before fixing.

---

## PHASE 9 — Conversion Impact Ranking

| # | Finding | Priority | Impact |
|---|---|---|---|
| 1 | Multi-word make normalization mismatch — ~2,400 certified records unreachable (Mercedes-Benz 1,591, Land Rover 627, Alfa Romeo 119, Aston Martin 40) | **P0 — revenue loss** | Luxury-brand shoppers (high AOV wheels) get "no vehicle found" sitewide + Jake |
| 2 | Selector/coverage queries skip CERTIFIED_FILTER → deprecated/needs_review trims offered, resolver refuses → dead-end UX | **P1** | "Trim shown → no fitment" on every staggered 2018 vehicle |
| 3 | 20 phantom 2018-only makes ("Chevrolet Minivans"…) in make selector | **P1** | Visible data-quality embarrassment + broken selections (fix already staged in migration) |
| 4 | 74 missing bores / 30 missing bolts — wheel-sale safety | **P1/P2** | Verify exclusion; backfill queue ready |
| 5 | Mercedes split storage ("Mercedes" 1,384 vs "Mercedes-Benz" 1,691) — model lists differ per storage make | **P2** | Even after P0 fix, brand data is bifurcated; needs merge with model-diff review |
| 6 | 169 needs_review certified=no rows reachable by selectors | **P2** | Same trap as #2, smaller scale |
| 7 | Jake model-nickname coverage ("Vette", "G-Wagon") | **P2** | Conversational misses |
| 8 | profileService.ts 66KB + 3,100-line wheel route + `.backup` file in repo | **P3** | Maintenance risk |
| 9 | Static fallback make list drift (`getFallbackMakes`) | **P3** | Only matters during DB outage |

---

## PHASE 10 — Fix Plan

### Critical (P0) — make-matching fix
**Change make comparisons to slug-normalized equality on BOTH sides.** One helper, used by safeResolver, coverage, getFitment, profileService:
```ts
// shared helper
export function makeSlugMatch(col: AnyColumn, input: string) {
  return sql`LOWER(REGEXP_REPLACE(${col}, '[^a-zA-Z0-9]+', '-', 'g')) = ${canonicalMake(input)}`;
}
```
- Risk: LOW (widens matching, never narrows; index-friendly via expression index `CREATE INDEX ... ON vehicle_fitments (LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g')))`)
- Complexity: LOW (4 call sites + 1 index + tests)
- Impact: HIGH — restores ~2,400 records / 4 luxury brands immediately
- Test: resolver-test script already written (`ecosystem-audit-resolver-test.mjs`) — unreachable column must go to 0

### High-impact (P1)
1. **Apply CERTIFIED_FILTER in coverage.ts** (years/makes/models/trims) so selectors never offer what the resolver won't serve. Risk LOW; one WHERE clause per function; instantly fixes the staggered-2018 dead ends even before the deletion migration runs.
2. **Run the staged 2018 cleanup migration** (already validated, 92% confidence) — removes deprecated rows + phantom makes at the source.
3. **Verify + enforce wheel-search exclusion** of missing-bore/bolt records (add `center_bore_mm IS NOT NULL` guard to wheel-path queries if absent); keep tire path serving them.

### Quick wins (low risk)
- Add spaced-make aliases to `MAKE_TO_CANONICAL` as a belt-and-suspenders alongside the P0 fix.
- Add Jake model nicknames to `modelAliases.ts` (vette→corvette, stang→mustang, g-wagon→g-class, beemer/bimmer→bmw-handled-at-make).
- Delete `profileService.ts.backup` from the repo.
- Add `vw_integrity_summary` (staged in migrations/) to `npm run pre-deploy`.

### Long-term
1. **Single make-canonicalization migration** — normalize DB storage to one convention (proper-case display names), merge Mercedes/Mercedes-Benz after model-diff review, then simplify the alias layer to display-only.
2. **Split profileService.ts / wheel fitment-search route** into testable modules.
3. **Jake failure-loop analytics:** weekly job diffs "can't find vehicle" transcripts against DB coverage to auto-file alias gaps.
4. **Live E2E test harness:** scripted selector→fitment→tires→wheels→package→cart pass over the 11-vehicle matrix against a running dev server (the missing piece of this audit).

### Implementation order
1. P0 make-match helper + index + tests (hours)
2. CERTIFIED_FILTER in coverage.ts (hours)
3. Cache purge (Redis + CDN) after 1-2
4. 2018 cleanup migration (already approved/staged)
5. Wheel-path bore/bolt guard verification
6. Quick wins batch
7. Long-term items as scheduled work

**No code or data was changed during this audit.** Proposed P0 patch is documented above but NOT applied.

---

## Appendix — Evidence Index
- `scripts/ecosystem-audit-db.json` — certification×year, tier×cert, source×cert, test-vehicle matrix, 2018-only makes
- `scripts/ecosystem-audit-resolver-test.json` — reachability table proving the P0
- `scripts/2018-INVESTIGATION-REPORT.md` — May 7/14 import forensics
- `scripts/migrations/STAGING-VALIDATION-REPORT.md` — staged cleanup dry-run (652 deletions verified)
- Key code: `src/lib/fitment/makeAliases.ts` (canonicalMake), `src/lib/fitment-db/{safeResolver,coverage,getFitment,profileService}.ts` (call sites), `src/app/api/vehicles/*/route.ts` (selectors), `src/lib/jake/tools.ts` (Jake)