# Fix Batch 1 — CONSOLIDATED REQUIREMENTS (authoritative, 2026-09-18 13:58)

This file supersedes the original task text and every earlier inter-session message. Where the existing code
(commits e2211ac6, c684a1e0, 81959ba8) conflicts with this file, the code is wrong and must be changed.

## Ground rules
- Work only in `F:\clawd\wt-fitment-fix` (branch `fix/fitment-audit-2026-09-18`). Never touch `F:\clawd\warehouse-tire-site`.
- No DB writes, no deploy, no push, no supplier/order calls. Read-only SQL only.
- NEVER call `/api/fitment/validate` or `/api/fitment/validate-wheels` (they run `CREATE TABLE IF NOT EXISTS` on the live DB).
- Preserve all existing commits and work; fix forward, do not reset/discard.
- Checkpoint to `fix-batch1-progress.md` every ~15 min and after each section below. The checkpoint is a write-and-continue, not a stop.
- Hard budget for this continuation: 60 minutes. If a section cannot be finished, write it up as UNFIXED with the reason.

## R1. Preview isolation (do BEFORE starting the dev server)
1. Run read-only privilege checks on the `.env.local` POSTGRES_URL role:
   `SELECT rolsuper, rolcreatedb FROM pg_roles WHERE rolname = current_user;`
   `SELECT has_table_privilege(current_user,'vehicle_fitments','UPDATE');`
   Record the result in the progress file. Do not create roles or change grants.
   **KNOWN RESULT (previous worker): the role is `neondb_owner` and HAS write privileges, and `/api/tires/search` writes `tireweb_sku_cache` (and possibly `tire_map_cache`).** Shared-DB cache writes from the preview are NOT acceptable — "cache only" is not an exemption. Before starting :3002 you must make the preview incapable of writing, using one of (in order of preference):
   a. Session-level read-only enforcement: set the connection to read-only for the preview — e.g. append `options=-c default_transaction_read_only=on` to the POSTGRES_URL in the worktree `.env.local` (verify with `SHOW default_transaction_read_only;` through the app's own db client) so any INSERT/UPDATE fails at the server; AND add a `FITMENT_PREVIEW_READONLY=1` (or similar) env switch that skips DB cache writes (`tireweb_sku_cache`, `tire_map_cache`, any `INSERT ... ON CONFLICT` in exercised paths) so the app does not error on them; or
   b. Fixture/in-memory DB for the routes under test.
   Do NOT hit `/api/tires/search` or any other route live on :3002 with owner credentials while cache writes are enabled. Grep for every write (`insert(`, `update(`, `delete(`, `INSERT`, `UPDATE`, `UPSERT`, `ON CONFLICT`) reachable from the exercised routes and list each with its disposition (skipped by switch / blocked by read-only session) in the progress file. Prove it: exercise the route once and confirm zero rows changed (e.g. `SELECT count(*), max(updated_at) FROM tireweb_sku_cache` before/after, read-only).
2. Shared Redis: `src/lib/fitment/fitmentCache.ts` (CACHE_VERSION "v5") and other cache clients hit production Upstash. Remove/blank `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_*`, `REDIS_URL` from the worktree `.env.local` (never commit it). Confirm the code degrades to no-cache / in-memory without crashing; if it cannot, add a guarded in-memory fallback or `FITMENT_CACHE_DISABLED=1` switch. Record what you did.
3. Bump `CACHE_VERSION` v5 → v6 in fitmentCache.ts. Grep for any other cache keys/versions that store resolver/profile/tire-search/package output (key prefixes containing fitment / profile / vehicle / tires / package) and bump or namespace those that carry fields changed by this batch. List every key/version touched in the handoff.
4. Inventory other shared write side effects on exercised paths (Redis, Vercel Blob, db-reporter tables, analytics inserts) in the progress file.

## R2. Exact model resolution (F5) — verify existing commit e2211ac6
- No substring path may cross models. "2024 Ford Mustang" → 5x114.3 / 70.5; "Mustang Mach-E" → 5x108 / 63.4. Aliases keep working (Silverado 2500 HD→2500HD, F-250→Super Duty, Mercedes→Mercedes-Benz).
- Grep every import of the functions changed (`modelNormalizedMatch`, `modelMatch.ts` users, `getFitment.ts`, `coverage.ts`, profileService) and confirm every public caller still compiles and behaves. `getOemTireSizesByFamily.ts` intentional family ILIKE: confirm it is not reachable from any fit-certification path; note in progress file.

## R3. Trim ambiguity (F7) — REWRITE `src/lib/fitment-db/trimAmbiguity.ts`
Independent checks against the current file FAIL on known+unknown agreement and equal-tires/different-wheel-width. Required semantics:
- Per-field tri-state: `agree | disagree | unknown`. A null/missing value in ANY trim makes that field `unknown`. `unknown` never counts as agreement.
- Fields compared (minimum): boltPattern, centerBore, threadSize, oemWheelSizes (diameter + width + offset, per axle), oemTireSizes (per axle), requiredLoadIndex, staggered flag.
- Differing wheel width / diameter set / offset / axle config / load requirement → trim required even when tire-size strings match.
- Partial agreement is NOT fit certification. Expose agreed fields as `sharedSpecs` with `certifiable: false` for browsing. Any `fits: true` / Guaranteed / Verified / Perfect claim requires every relevant field `agree` OR a selected trim.
- `assessTrimAmbiguityForYmm`: remove `.limit(50)` for the Y/M/M scope, or `count(*)` first and treat `count > limit` as `unknown` on every field (trim required).
- The `catch` in profileService's ambiguity check must NOT log-and-continue into arbitrary resolution. Return `resolution: "error"`, `certifiable: false`, `trimRequired: true`.
- Auto-select without trim only when all compared fields `agree`, or single trim / grouped record (existing behaviour) — and grouped records must still be checked field-by-field, not assumed.

### check-fitment (F7/F13) — fix regression in c684a1e0
- Current code sets `trimRequiredNote`, skips geometry, and can return `fits: true` on shared bolt pattern. FORBIDDEN.
- No trim + constraints unresolved → `fits: null`, `reason: "trim_required"`, optionally `boltPatternCompatible: true|false`. Bolt disagrees → `trim_required`. Bolt agrees but width/offset/dia disagree → `fits: null`, `reason: "trim_required_for_geometry"`, `boltPatternCompatible: true`. Never overall `fits: true` from partial agreement.
- Existing negative cases unchanged: bolt mismatch rejected; Fuel `D68117906545` on 2024 Camry → `geometry_rejected`.

### Universal resolver consumers
`universalFitmentResolver` still auto-selects a trim from metadata. Grep every consumer (fitment-search, tire-sizes, packages/recommended engine.ts, tires/search, check-fitment, Jake, POS, staggered-search, plus-sizes, anything else importing it) and make sure none bypasses the ambiguity gate: either route auto-select through trimAmbiguity, or have the resolver return `trimRequired`/`certifiable:false` and make each consumer honour it (packages → no certified packages; fitment-search may browse on sharedSpecs with NO fit badge). List each consumer and its disposition in the progress file.

## R4. Load-index gating (F3) — REWRITE `src/lib/tires/loadIndexGate.ts` (draft in 81959ba8 is wrong)
- Grep FIRST and record actual enforcement in: `/api/tires/search`, tire cards/badges (Guaranteed/Verified/Perfect Fit strings), tire PDP, `src/lib/packages/*`, staggered-search, add-to-package / add-to-cart gates.
- The vehicle-record minima (Raptor 119, M4 100, …) are NOT verified OEM and NOT axle-specific. Never label them OE/OEM/factory in UI or API. Fields: `requiredLoadIndex`, `requiredLoadIndexSource` (e.g. `"vehicle_record_unverified"`), `tireLoadIndex`, `loadIndexOk: true|false|null`, `loadIndexChecked`.
- Tire below required → EXCLUDE from recommended/compatible packages and BLOCK every fit-certified package/cart construction path with reason code `load_index_below_required`. Generic unverified browsing MAY show it with a clear message ("Load rating 110 is below the 119 this vehicle requires") and NO fit badge.
- Missing or unverified minimum → `fitBadgeAllowed: false`. A green/Guaranteed/Verified badge appears ONLY when a requirement exists AND the tire meets it. (The draft's "missing minimum ⇒ fitBadgeAllowed:true" is the opposite and must be inverted.)
- Per-axle where the record has front/rear data; single value otherwise.
- Wire into packages if packages currently claim fit.

## R5. Tests (required before handoff)
- Unit (pure helpers, fixtures): modelMatch; trimAmbiguity cases (a) same tires / different width-offset → trim_required; (b) same tires / different requiredLoadIndex → trim_required; (c) known+unknown bolt → unknown, no auto-resolve, no badge; (d) full agreement → auto-resolve; (e) staggered vs square with overlapping front size → trim_required; (f) >limit candidate rows with the conflicting one last → trim_required. loadIndexGate: 110<119 → blocked; 99<100 → blocked; equal → ok; missing requirement → no badge.
- Endpoint/integration (repo's route-test pattern; mock DB layer or fixtures; assert response shape + reason codes):
  `/api/vehicles/search` 2024 Ford Mustang → 5x114.3 not Mach-E; Mach-E → 5x108; 2024 BMW M4 no-trim → trimRequired; 2023 Ram 1500 no-trim → not 325/65R18; 2020 Civic no-trim → not Si envelope; ambiguity query throws (mock) → non-certifiable.
  `/api/fitment/profile` same M4 / error cases.
  `/api/wheels/check-fitment` M4 no-trim + 5x120 SKU → `fits:null, reason:"trim_required", boltPatternCompatible:true`; Fuel on Camry → geometry_rejected unchanged.
  `/api/tires/search` 2020 Raptor 17" → 110T tires `loadIndexOk:false`, no badge; packages → no certified package containing a below-required tire.
- Run the whole existing suite before/after; report command + pass/fail counts.

## R6. Local verification and handoff
- Dev server on PORT 3002 (isolated cache, R1 done). Hit and record JSON for: `/api/vehicles/search?year=2024&make=Ford&model=Mustang`, `/api/wheels/check-fitment?sku=D68117906545&year=2024&make=Ford&model=Mustang`, `/api/vehicles/search?year=2024&make=BMW&model=M4`, `/api/wheels/check-fitment?year=2024&make=BMW&model=M4&sku=<a 5x120 sku from fitment-search>`, `/api/tires/search` for 2020 F-150 Raptor 17".
- Small conventional commits; no push.
- Handoff in `fix-batch1-progress.md` and in your final message: commits, files changed, test command + counts, cache keys bumped, privilege-check result, consumer disposition table, retest URLs on :3002, UNFIXED items with reasons.

## R4 addendum (14:13, reviewer acceptance test) � semantics clarification, binding
- ssessLoadIndex("119", 119) with equiredLoadIndexSource: "vehicle_record_unverified" currently returns itBadgeAllowed: true. FAIL. An UNVERIFIED requirement can never certify fit, even when the tire index is equal or higher.
- Keep two separate outputs: loadIndexOk (compatibility vs the stored requirement: true/false/null) and itBadgeAllowed (certification). itBadgeAllowed is true ONLY when the requirement source is a verified one (none exists today ? always false) AND the tire meets it. Below-required still excludes from certified packages/cart (packageEligible:false, reason load_index_below_required) regardless of source.
- Regression tests to add: unverified source + equal index ? loadIndexOk:true, itBadgeAllowed:false; unverified + higher ? same; unverified + lower ? loadIndexOk:false, itBadgeAllowed:false, packageEligible:false; missing ? loadIndexOk:null, itBadgeAllowed:false.
