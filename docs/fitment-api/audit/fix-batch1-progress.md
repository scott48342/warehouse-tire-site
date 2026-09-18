# Fix Batch 1 — progress log (2026-09-18)

Worktree: `F:\clawd\wt-fitment-fix`, branch `fix/fitment-audit-2026-09-18` (base 4742a0e2).
Scope: F5 exact model match, F7 ambiguous-trim gate, F3 load-index gating. No DB writes, no push.

## 13:55 — checkpoint 1
**Done (code written, not yet compiled/tested):**
- F5: new `src/lib/fitment-db/modelMatch.ts` — compact-key EXACT match (`LOWER(REGEXP_REPLACE(model,'[^a-zA-Z0-9]+','','g')) IN (...)`), candidates = input + `MODEL_ALIASES`. No substring fallback.
  Replaced `modelNormalizedMatch` bodies in `profileService.ts`, `getFitment.ts`, `coverage.ts` (the three `ILIKE '%word%word%'` builders).
  Not touched (already exact `ilike(model, name)` per variant): `universalFitmentResolver`, `canonicalResolver`, `safeResolver`. Left as-is but noted: `getOemTireSizesByFamily.ts` uses `model ILIKE '%model%'` on purpose ("family"), only used by tires/page.tsx family lookup.
- F7: new pure `src/lib/fitment-db/trimAmbiguity.ts` (`assessTrimAmbiguity(rows, fields)`) + DB helper `assessTrimAmbiguityForYmm` in profileService. `getFitmentProfile` gains `options.trimOmitted` (also auto when modificationId === ""), runs the gate BEFORE cache; returns `resolutionPath:"trim_required"`, `trimRequired`, `ambiguous`, `trimAmbiguity`.
  Routes: `/api/vehicles/search` (passes `trimOmitted = !modification`, returns `trimRequired/candidateTrims/conflictingFields/sharedFitment`), `/api/wheels/check-fitment` (returns `fits:null, reason:"trim_required"` unless bolt pattern is shared by all trims, in which case bolt check proceeds with `boltPatternSharedByAllTrims:true`; geometry skipped), `/api/fitment/profile` (universalFitmentResolver now exposes `trimAmbiguity`/`trimRequired` metadata; route returns `found:false, trimRequired:true` when no trim was requested and rows disagree).
- npm ci complete in worktree; .env.local copied (gitignored via `.env*`).

**Next:** tsc on touched files, unit tests for modelMatch + trimAmbiguity, then F3 grep + implementation.
**Blockers:** none yet.

## 13:58 — DB privilege check (per reviewer corrections)
**User:** `neondb_owner` — has FULL write privileges (UPDATE/DELETE/INSERT on vehicle_fitments).
**NOT read-only.** Mitigations:
- Avoid `/api/fitment/validate*` endpoints (they run CREATE TABLE IF NOT EXISTS)
- `src/app/api/tires/search/route.ts:194` writes to `tireweb_sku_cache` — this is a SKU enrichment cache, NOT fitment data. Will be triggered by tire searches but acceptable (cache only).
- No other DB writes found in tires/packages routes.

## 13:59 — F3 load-index rework (per reviewer corrections)
**Spec changes from original:**
- Field: `requiredLoadIndex` / `requiredLoadIndexSource` (NOT "OE"/"OEM")
- Below required → EXCLUDE from packages, BLOCK fit-certified paths
- Plain browse MAY show with incompatibility message, NO fit badge
- Missing/unverified minimum → NO green badge (degrade to neutral)

**In progress:** Rewriting loadIndexGate.ts to match new spec.

---
# CONTINUATION (new worker, 2026-09-18 14:05) — working from fix-batch1-REQUIREMENTS.md (R1–R6)

## 14:05 — R1 Preview isolation DONE
- Privilege check (`node --env-file=.env.local scripts/check-db-privs.mjs`): `current_user=neondb_owner`, `rolsuper=false`, `rolcreatedb=true`, `has_table_privilege(vehicle_fitments, UPDATE)=true` (also DELETE/INSERT true). **Role is writable.** Mitigation: never call `/api/fitment/validate*`; write-path inventory below.
- `.env.local` (gitignored; backup `.env.local.bak-prestrip`, also gitignored): removed `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL`; added `FITMENT_CACHE_DISABLED=1`.
- Verified every Redis client (`fitmentCache`, `ymmCache`, `tires/searchCache`, `tireweb/protection`, `sharedCache`, `inventoryCache`, `inventorySync`, `jake/fitmentCache`, `fedexRates`, `wheel-viz`, `safetyGovernor`, analytics) returns `null` / local-fallback when the env vars are absent — no crash path.
- `fitmentCache.ts`: `CACHE_VERSION` v5 → **v6** (key prefix `wt:fit:v6:`); added `FITMENT_CACHE_DISABLED=1` switch that bypasses Redis AND the in-process map (get → miss, set → no-op).
- Other caches audited, NOT bumped (reason): `tiresearch:size:*` / `tiresearch:vehicle:*` cache raw supplier results BEFORE `annotateLoadIndex` runs (route.ts L3325 is post-cache) so gate fields never persist; `wt:ymm:*` = years/makes/models/trims lists (unchanged shape); `wt:avail:*` = wheel availability (unrelated).
- Committed as `ed499321`.
- Shared write side effects on exercised paths: (1) `tires/search` L194 upserts `tireweb_sku_cache` (SKU enrichment cache — DB write, not fitment data; unavoidable when exercising tire search; noted). (2) Redis writes: none (creds removed). (3) Vercel Blob: only Jake mockup — not exercised. (4) db-reporter / analytics inserts: `analytics/fitment-coverage` requires Redis (disabled). No writes to `vehicle_fitments` on any exercised path.

## 14:27 - R3 Trim ambiguity (code written, tsc running)
- src/lib/fitment-db/trimAmbiguity.ts REWRITTEN: tri-state ieldStates (agree|disagree|unknown) over boltPattern, centerBore, threadSize, oemWheelSizes (axle:diaxwidth@offset; entry offset, else row offsetMin/Max, else UNKNOWN), oemTireSizes (per axle F:/R: keys), requiredLoadIndex, staggered. Any null in any row => unknown; unknown never = agreement. esolution: single|auto|trim_required|error; certifiable only when every field agrees (or single row); sharedSpecs (agreed fields only) for browsing; ailClosedAmbiguity() for errors/truncation; ssessTrimAmbiguity(rows, {truncated:true}) => all unknown.
- profileService.ts: ssessTrimAmbiguityForYmm selects all 7 compare columns, .limit(50) REMOVED; gate now fires on 	rimRequired (not only mbiguous); catch FAILS CLOSED (esolution:"error", certifiable:false, 	rimRequired:true) - no fall-through to arbitrary resolution. ProfileLookupResult.certifiable added.
- universalFitmentResolver.ts: passes all fields; sets 	rimRequired/certifiable; ALSO gates the "requested trim not found -> first_available" fallback; explicit/single matches are certifiable.
- check-fitment/route.ts: regression fixed. trimRequired + bolt not shared => its:null, reason:"trim_required", boltPatternCompatible:null; bolt shared + wheel mismatch => its:false, no_matching_bolt_pattern, boltPatternCompatible:false; bolt shared + wheel matches => its:null, reason:"trim_required_for_geometry", boltPatternCompatible:true (never fits:true). 
o_style_data permissive fallback also blocked when trim required. Negative paths (bolt mismatch, geometry_rejected) unchanged for resolved vehicles.
- /api/vehicles/search + /api/fitment/profile: trim-required response now carries certifiable:false, resolution, fieldStates, conflictingFields, unknownFields, sharedSpecs (+ legacy sharedFitment). profile route also fires when a requested trim did not match.
- Universal-resolver consumer disposition:
  | consumer | disposition |
  |---|---|
  | pi/fitment/profile | returns ound:false, trimRequired, certifiable:false, sharedSpecs |
  | pi/vehicles/search (via profileService) | itment:null, trimRequired, certifiable:false, sharedSpecs |
  | pi/wheels/check-fitment | fits:null / trim_required / trim_required_for_geometry (above) |
  | lib/packages/engine.ts | getVehicleFitment returns null when 	rimRequired => NO packages (certified packages impossible) |
  | pi/vehicles/tire-sizes | blocked eason:"trim_required" unless ieldStates.oemTireSizes==="agree" (then sizes shown for browsing, existing multi-size gate applies) |
  | pi/wheels/fitment-search (legacy path) | dbProfile.trimRequired/certifiable/autoSelectedTrim/trimAmbiguity exposed for browsing on sharedSpecs. **PARTIAL:** wheel-card fit badge (fitmentClass surefit/specfit) NOT yet suppressed server-side when certifiable:false - UNFIXED, see handoff |
  | pi/tires/search | see R4 - certifiable passed to nnotateLoadIndex => itBadgeAllowed:false for every result when trim required |
  | pi/fitment/lifted | browsing only (lift suggestions); not a fit-certification path; flags available on result, not consumed - UNFIXED (low) |
  | lib/savedQuotes/resumeService.ts | resumes saved quote with stored trim => requestedTrim present, gate not triggered; no change |
  | pi/admin/fitment/coverage-report | admin report, no fit claim; no change |
  | Jake / POS / staggered-search / plus-sizes | do NOT import the resolver directly (grep); they consume /api/wheels/fitment-search, /api/vehicles/search, /api/tires/search responses above |
