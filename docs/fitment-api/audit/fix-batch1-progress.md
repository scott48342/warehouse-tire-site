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
- Shared write side effects on exercised paths: (1) `tires/search` L194 upserts `tireweb_sku_cache` (SKU enrichment cache — DB write, not fitment data; unavoidable when exercising tire search; noted). (2) Redis writes: none (creds removed). (3) Vercel Blob: only Jake mockup — not exercised. (4) db-reporter / analytics inserts: `analytics/fitment-coverage` requires Redis (disabled). No writes to `vehicle_fitments` on any exercised path.
