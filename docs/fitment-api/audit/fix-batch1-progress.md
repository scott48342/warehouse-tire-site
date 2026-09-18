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
