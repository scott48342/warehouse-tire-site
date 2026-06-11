# P0 Fix Report: Multi-Word Make Normalization

**Date:** 2026-06-10 · **Branch:** `fix/p0-make-normalization` · **Commit:** `da14ef8`
**Patch for review:** `scripts/p0-make-normalization.patch` (NOT deployed, NOT merged)
**Spec:** `g:\clawd\fable-p0-make-fix.md`

---

## 1. Problem (recap)

- `canonicalMake("Land Rover")` → `"land-rover"` (hyphenated slug)
- DB stores `"Land Rover"` (spaced, proper case)
- `ILIKE 'land-rover'` with no wildcards = case-insensitive **equality** → never matches
- Several paths were worse: `eq(make, input.toLowerCase())` (case-sensitive `=` vs proper-cased DB)

## 2. Phase 1 — Audit of all make-comparison code paths

Full grep of `normalizeMake|canonicalMake|makeCaseInsensitive` + every query touching `vehicleFitments.make` (~150 references). Classification:

### 🔴 BROKEN — fixed in this patch (runtime read paths)

| File | Pattern before | Used by |
|---|---|---|
| `fitment-db/safeResolver.ts` (4 queries) | `ilike(make, slug)` | tire-sizes API, fitment resolution |
| `fitment-db/coverage.ts` (`makeCaseInsensitive`, 5 call sites) | `lower(make) = slug` | years/makes/models/trims selector APIs |
| `fitment-db/getFitment.ts` (3 queries) | `ilike(make, slug)` | wheel/tire/package fitment listing (`listFitmentsWithTierFilter`) |
| `fitment-db/profileService.ts` (`makeCaseInsensitive`, 8 call sites) | `lower(make) = slug` | `/api/wheels/fitment-search` (getFitmentProfileWithHdSupport) |
| `fitment-db/getFitmentConfigurations.ts` (3 queries) | `eq(make, slug)` — case-sensitive! | configurations API |
| `fitment-db/fitmentInheritance.ts` (5 queries) | `eq(make, slug)` | generation inheritance fallback |
| `fitment-db/wheelSizeTrimMapping.ts` (1 vehicle_fitments query) | `ilike(make, slug)` | trim mapping |
| `fitment/canonicalResolver.ts` (`makeLikeAny`, 4 call sites) | `ILIKE ANY(variants)` — partially worked but leaked nickname matches ("mb", "rover") | trims API atomic options |
| `api/public-fitment-service.ts` (3 queries) | `eq(make, slug)` — case-sensitive! | public fitment API (B2B) |
| `seo/counts.ts`, `seo/legacy.ts`, `seo/fitment.ts` | `eq(make, lower(input))` — case-sensitive `=` vs "Land Rover" → broken for ALL proper-cased makes | SEO landing pages |
| `admin/fitment/config-enrichment/*` (3 queries) | `ilike(make, makeKey)` | admin enrichment |

### 🟢 NOT CHANGED — correct or out of scope (write/import paths)

| File | Why untouched |
|---|---|
| `importFitment.ts`, `normalize.ts`, `applyOverrides.ts` (writes), `fitmentManualImport.ts`, `research/*` | **Import/write paths** — they normalize then *store*; matching on their own just-written values is self-consistent. Changing write normalization = data migration (explicitly out of scope). |
| `vehicleFitmentRules.ts` | Compares against in-memory rule constants already in canonical form. |
| `coverageMetrics.ts` | In-memory key building (both sides use same normalizeMake). |
| `getFitmentConfigurations` → `vehicleFitmentConfigurations.makeKey` queries | `make_key` column **stores canonical slugs** — already consistent. Only its `vehicle_fitments` fallback queries were broken (fixed). |
| `admin/fitment/bulk` | Admin write tooling operating on explicit values. |
| `validationService.ts`, `repairService.ts` | Admin filters fed from DB-sourced values. |
| Jake (`lib/jake/tools.ts`) | Calls internal HTTP APIs via fetch → **fixed transitively**. |

## 3. Phase 2 — The fix

**New file: `src/lib/fitment-db/makeMatch.ts`**

```ts
makeSlugMatch(col, input)
// SQL: LOWER(REGEXP_REPLACE(col, '[^a-zA-Z0-9]+', '-', 'g')) IN (slug candidates)
```

- Candidates = slug(input) ∪ canonicalMake(input) ∪ slug(displayMake(input))
  - `"Land Rover"` → `[land-rover]` — matches DB "Land Rover", "land rover", "Land-Rover"
  - `"Mercedes-Benz"` / `"Mercedes"` / `"MB"` → `[mercedes-benz, mercedes]` — matches **both** DB storages (split-brand bridge until storage is merged)
  - `"Chevy"` → `[chevy, chevrolet]`; `"Toyota"` → `[toyota]` (single-word unchanged)
- **Deliberately excludes nickname slugs on the column side** — "Land Rover" can never match a DB make "Rover"; "Mercedes-Benz" never matches "Mercedes-Benz Vans" (verified by test).
- Empty input → `FALSE` (matches nothing, not everything).
- **No database contents changed. No data migration required.**
- `canonicalResolver.makeLikeAny` was replaced by the helper — it previously matched `make ILIKE 'mb'` style nicknames on the column, a latent false-positive risk.

**Optional index (generated, NOT run):** `scripts/migrations/p0-make-slug-index.sql`
`CREATE INDEX CONCURRENTLY idx_vf_make_slug ON vehicle_fitments (LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g')))` + rollback note. At 37.5k rows it's optional; included for hot selector paths and growth.

## 4. Files changed (18)

```
NEW  src/lib/fitment-db/makeMatch.ts                     helper (94 lines)
NEW  src/lib/fitment-db/__tests__/makeMatch.test.ts      29 tests
NEW  scripts/migrations/p0-make-slug-index.sql           optional index + rollback
MOD  src/lib/fitment-db/safeResolver.ts                  4 queries → makeSlugMatch
MOD  src/lib/fitment-db/coverage.ts                      makeCaseInsensitive() → helper
MOD  src/lib/fitment-db/profileService.ts                makeCaseInsensitive() → helper
MOD  src/lib/fitment-db/getFitment.ts                    3 queries
MOD  src/lib/fitment-db/getFitmentConfigurations.ts      3 queries (was case-sensitive eq)
MOD  src/lib/fitment-db/fitmentInheritance.ts            5 queries (was case-sensitive eq)
MOD  src/lib/fitment-db/wheelSizeTrimMapping.ts          1 query
MOD  src/lib/fitment/canonicalResolver.ts                makeLikeAny() → helper
MOD  src/lib/api/public-fitment-service.ts               3 queries (was case-sensitive eq)
MOD  src/lib/seo/counts.ts, legacy.ts, fitment.ts        was case-sensitive eq + model ilike fix
MOD  src/app/api/admin/fitment/config-enrichment/{,batch/}route.ts   3 queries
```
Diff: **+502 / −39** (includes tests/SQL; runtime code delta is small — each call site is a one-line swap).

## 5. Phase 3 — Test results

**New unit suite** `makeMatch.test.ts`: **29/29 pass** ✅
- Slug equivalence (spaces/hyphens/case/punctuation)
- All 4 P0 brands match all storage variants (incl. 2024 lowercase "land rover" strays)
- Mercedes bridges both storages; nicknames (MB, Chevy, VW) resolve
- Spec's required brands covered: Mercedes-Benz, Land Rover, Alfa Romeo, Aston Martin, Toyota, Ford, Chevrolet, Jeep
- Negative cases: Ford≠Chevrolet, "Land Rover"≠"Rover", "Mercedes-Benz"≠"Mercedes-Benz Vans"

**Regression check:** `npx jest src/lib/fitment` on branch vs base (stash test):
- Base (before fix): 18 failed / 158 passed
- Branch (with fix): 18 failed / 187 passed — **identical 5 pre-existing failing suites** (staggeredCanonical, makeNormalization, staggeredFitment, fitmentRegression, canonicalResolver — DB-dependent/stale-expectation tests broken before this work), **+29 new passing**, zero new failures.

**TypeScript:** `npx tsc --noEmit` → clean exit 0. ✅

**Per-flow coverage:** selector resolution (coverage.ts), fitment lookup (safeResolver/getFitment), wheel search (profileService), tire search (tire-sizes→safeResolver), Jake (transitive via HTTP APIs) — all route through patched functions. Live HTTP smoke test still recommended post-deploy (dev server not run here).

## 6. Phase 4 — Before/after measurement (live DB, read-only)

`scripts/p0-make-fix-validation.mjs` — simulates old vs new SQL against production data (certified rows):

| Input | Before reachable | After reachable | Recovered |
|---|---|---|---|
| Mercedes-Benz / Mercedes | 1,384 | **2,975** | **+1,591** |
| Land Rover | 0 | **627** | **+627** |
| Alfa Romeo | 0 | **119** | **+119** |
| Aston Martin | 0 | **40** | **+40** |
| Rolls-Royce, Toyota, Ford, Chevrolet/Chevy, Jeep, RAM, MINI, BMW | unchanged | unchanged | 0 |

**Total recovered: 2,377 certified records. Unreachable after fix: 0 for all tested makes. Regressions: 0.**
Raw data: `scripts/p0-make-fix-validation.json`.

## 7. Risk assessment

| Risk | Level | Notes |
|---|---|---|
| Behavior change scope | **LOW** | Matching only ever *widens* (never excludes previously-matching rows: old equality implies new slug equality) |
| False positives | **LOW** | Slug equality, not pattern match; nickname slugs excluded column-side; negative tests prove "Mercedes-Benz Vans" / "Rover" stay separate |
| Mercedes split-storage bridge | **MEDIUM-aware** | Intentional: both storages now serve one brand. Model lists merge from both; if the two storages disagree on a Y/M/M trim, both surface. Long-term fix = make-canonicalization data migration (already on roadmap) |
| Performance | **LOW** | REGEXP_REPLACE per row prevents plain-index use; table is 37.5k rows and queries are year-filtered + Redis-cached. Optional expression index provided |
| Type safety | **LOW** | tsc clean; drizzle `SQL` conditions are drop-in for `ilike()/eq()` |
| Stale caches | **MEDIUM (operational)** | Redis YMM caches + CDN (makes: 24h s-maxage) hold pre-fix results. **Purge Redis + CDN after deploy** or recovered brands stay invisible up to a day |
| Pre-existing test failures | none added | 18 failures exist on base; unchanged by this patch |

## 8. Deliverables checklist

1. ✅ Branch `fix/p0-make-normalization` (commit `da14ef8`)
2. ✅ Patch: `scripts/p0-make-normalization.patch` (~64 KB, single commit)
3. ✅ Files changed list (§4)
4. ✅ Diff summary (§4)
5. ✅ Test results (§5)
6. ✅ Before/after counts (§6 + JSON)
7. ✅ Risk assessment (§7)
8. ✅ Optional index SQL: `scripts/migrations/p0-make-slug-index.sql`

**NOT done (per spec):** no deploy, no merge to main, no DB changes, no index created. After merge: deploy → purge Redis YMM caches + CDN → run optional index → live smoke test (`/api/vehicles/models?year=2024&make=Land Rover`).
