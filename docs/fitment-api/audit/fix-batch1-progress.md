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
- R3 committed as 1e4281de.

## 14:45 - R4 Load-index gate DONE (commit 5bd3a89f)
- Grep of actual enforcement before this batch: /api/tires/search L3325 nnotateLoadIndex (draft), TireStyleCardHorizontal amber warning + itBadgeAllowed prop (draft, NOT consumed by any badge renderer - the only tire "Guaranteed Fit" strings are static marketing copy: tires/page.tsx L2978, tires/[sku] L796/L1232, tires/km L414, cart L488, package/review L24/30). src/lib/packages/engine.ts builds placeholder tires (rand:"TBD"), real tires enter packages via /api/tires/search -> components/build/TireStep.tsx. staggered-search: no load-index logic.
- loadIndexGate.ts: draft's inversion was ALREADY corrected by the previous worker at 13:59 (missing minimum => itBadgeAllowed:false) - verified by test. Added: 	ireLoadIndex (spec field), itBlockReason (load_index_below_required | load_index_unverified | 	rim_required), certifiedPathBlock() (blocks only KNOWN below-required), nnotateLoadIndex(items, spec, {certifiable}) - trim gate forces itBadgeAllowed:false with reason 	rim_required. Per-axle via esolveRequiredLoadIndex(spec, axle) (front/rear win; oth = max) - record currently has a single oem_load_index column so per-axle input is null in practice.
- /api/tires/search: passes certifiable from the resolver; response adds certifiable, 	rimRequired; every result carries loadIndex/tireLoadIndex/requiredLoadIndex/requiredLoadIndexSource:"vehicle_record_unverified"/loadIndexOk/loadIndexChecked/loadIndexNote/fitBadgeAllowed/packageEligible/packageExclusionReason/fitBlockReason.
- Packages wired: components/build/TireStep.tsx filters out packageEligible:false tires and handleSelect refuses them (load_index_below_required). lib/packages/engine.ts returns no packages when trim required (R3).
- OE labels removed: TireStyleCardHorizontal fallback text "Load rating below OE" -> "Load rating is below what this vehicle requires"; RecommendedFitmentCard sidebar "OE load index" -> "Required load index".

## 14:48 - R5 Tests
- Command: 
px jest src/lib/fitment-db/__tests__/trimAmbiguity.test.ts src/lib/tires/__tests__/loadIndexGate.test.ts src/lib/fitment-db/__tests__/modelMatch.test.ts => **3 suites, 52 passed, 0 failed**. Cases (a)-(f) + Mustang/Mach-E bolt disagree + offset-unknown + failClosed; load-index 110<119, 99<100, equal, missing, trim-gate suppression.
- 
px tsc --noEmit -p tsconfig.json => 0 errors.
- **UNFIXED:** endpoint/integration tests for /api/vehicles/search, /api/fitment/profile, /api/wheels/check-fitment, /api/tires/search, packages (reason: 60-min budget exhausted; routes call the DB directly and check-fitment fetches /api/vehicles/search over HTTP - needs a mock layer not present in repo). Full existing jest suite before/after NOT run (same reason).

## 14:50 - R6 UNFIXED
- Dev server on :3002 not started; the retest URLs below were NOT hit (budget). R1 isolation is in place so the next worker can run set PORT=3002 && npm run dev immediately.

## 14:30 - Parent closeout (Clawd, main session) - READY FOR REVIEW
Worker sessions terminated and deleted (both were revived by queued turns after Stop; no further writers). Single writer from here.

**Post-handoff fixes by parent**
- cc5e19a0 R4 addendum: itBadgeAllowed now requires a VERIFIED requirement source (VERIFIED_LOAD_SOURCES, currently only erified_manufacturer, which NO production caller passes) AND tire meets. ehicle_record_unverified (the only source today) can never certify, even on equal/higher index; loadIndexOk (compatibility) and itBadgeAllowed (certification) are separate. itBlockReason = load_index_unverified when compatible-but-unverified. TireStyleCard amber "below required" warning now keyed on loadIndexOk === false (was itBadgeAllowed === false, which would have mis-warned every compatible tire). nnotateLoadIndex trim gate applies whenever loadIndexOk !== false. 9 regression tests added.
- 15384623 (worker follow-up run) R1 read-only enforcement: .env.local POSTGRES_URL carries options=-c default_transaction_read_only=on; FITMENT_PREVIEW_READONLY=1 skips the 	ireweb_sku_cache upsert; proof script scripts/audit/batch1-readonly-proof.mjs.

**R1 proof (parent re-ran 14:26, 
ode --env-file=.env.local scripts/audit/batch1-readonly-proof.mjs):**
default_transaction_read_only = on; role 
eondb_owner rolsuper=false rolcreatedb=true; 	ireweb_sku_cache count 35728; UPDATE ... WHERE false inside a rolled-back txn -> **BLOCKED: "cannot execute UPDATE in a read-only transaction"**. All app DB access is pg Pool via drizzle-orm/node-postgres (src/lib/db/pool.ts, fitment-db/db.ts, analytics/db.ts, visualizer/db.ts, db.ts) so the session option applies to every route. Worker's follow-up also hit /api/tires/search on :3002 with before/after count unchanged (35728). Other writers found by grep on lib/fitment* request paths (all blocked by the session option, none exercised): profileService modificationAliases upsert (L444-452), unresolvedFitmentTracker, missingFitmentService, researchedFitmentCache, oemPackageChoices upsert, gapAlerts.

**Tests:** 
px jest src/lib/tires/__tests__/loadIndexGate.test.ts src/lib/fitment-db/__tests__/trimAmbiguity.test.ts src/lib/fitment-db/__tests__/modelMatch.test.ts -> **3 suites, 60 passed, 0 failed**; 
px tsc --noEmit -> 0 errors.

**Still UNFIXED / for reviewer:** endpoint/integration tests (no route-mock layer in repo); full existing jest suite not run; :3002 retest URLs not hit by parent (dev server was started and stopped by the worker follow-up for the tires/search write proof only); fitment-search wheel-card surefit/specfit badge not suppressed when certifiable:false (PARTIAL); /api/fitment/lifted flags not consumed; getOemTireSizesByFamily family-ILIKE reachability note.

## 2026-09-18 16:05 - d6ecf384 check-fitment supplier fall-through + banners + mappers
- Endpoint retest 24/24 (SUMMARY.json committed). Previous last fail = Wheel-1/WSI SKUs wheel_not_found -> fits:false (false rejection). Root cause: check-fitment read only wp_wheels; M4 result set is Wheel-1 + WSI.
- NEW FINDINGS (not in original F1-F20):
  - F21 Wheel-1/WSI mappers fabricated offset "0" when offset_mm null (1 + 9 live rows) -> would pass geometry gate. Fixed: undefined.
  - F22 Wheel-1/WSI mappers exposed only pcd1/bp1; DB query matches pcd2/bp2 -> 486 + 4,280 dual-drilled wheels failed downstream bolt checks on 2nd pattern. Fixed: joined in techfeed "a/b" convention.
  - F23 check-fitment: SKU absent from all catalogs is UNKNOWN (fits:null), not a rejection.
- Banners neutralized: TirePageCompactHeader, WheelsGridWithSelection top picks, wheels/page badge (gated on certificationBlock).
- tires/page getBaseUrl honours PORT. Preview .env.local has NEXT_PUBLIC_BASE_URL=http://localhost:3002 (untracked).
- Jest: check-fitment 39/39; fitment-db + fitment-search 205/205 tests; 2 suite-level fails (staggeredCanonical, staggeredFitment) are in the 11-suite baseline.
- OWNERSHIP: Jake (src/lib/jake/*, src/components/jake/*, Jake tests/API guards) = Codex. I do not add/commit those paths.
- :3002 preview restarted after gateway restart (session oceanic-meadow, readonly flags).

## 2026-09-18 16:52 - 77a31b11 BATCH 2 (H1 lifted flow) - REVIEW-READY
- Flotation recovery in tireWebTireToUnified (0/0R17 -> 35X12.50R17), 11 tests. Lifted links carry liftedTireSizes + liftedSource; /tires seeds lifted list from size=. Lift ctx on all 48/48 PDP links.
- Assurance copy gated: TireCard/TireStyleCard "Fits" (fitBadgeAllowed), LiftedTireRecommendations guarantee, PDP "Guaranteed fitment" x4, TPMS direct-fit, Cart "Fits" (new CartItem.fitVerified, default neutral).
- Live: lifted page 35x12.50R17 x670 / 245-70R17 x0; API 40/40 correct; retest 24/24; tsc clean.
- Jake regressions J1-J4 in docs/fitment-api/audit/jake/REGRESSIONS.md. J1 = deployment blocker. Jake owned by Clawd from 16:24.
- NEXT: Jake J1-J4, then Batch 3 staggered (H2/H4), Batch 4 SKU continuity, Batch 5 packages.
