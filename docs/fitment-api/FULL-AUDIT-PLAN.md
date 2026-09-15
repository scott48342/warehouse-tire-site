# Fitment DB — Full Verified Audit & Completeness Plan

**Decision (Scott, 2026-09-15):** the entire `vehicle_fitments` table (37,840 rows; 36,337 active) gets a clean-sweep verification against independent sources, plus a gap analysis to reach a complete US-market YMMT dataset. Runs via subagents on `anthropic/claude-fable-5-1`. Takes priority over Shopify hosting.

**Why:** Prior "audits" (Apr 2026) certified 26k rows as `complete/certified/MEDIUM` without an external source. The r/tires launch thread found, in one day: phantom trims (Lexus GS F 2006–15), wrong widths on a whole generation, wrong bolt pattern (Astro 03–05), junk trims ("GT Front GT"), a missing trim (Mustang EcoBoost PP), and the public API leaking all 1,503 quarantined rows. `certification_status = certified` currently means nothing.

## Baseline (2026-09-15 09:50)
- 37,840 rows / 1,503 quarantined / 81 makes / 1,138 make+model / years 1950–2026. Active by decade: 50s 62 · 60s 382 · 70s 461 · 80s 1,080 · 90s 2,969 · 00s 7,872 · 10s 13,133 · 20s 10,378.
- 25 `source` families (trim-research 4,994; cache-import[expanded] 3,881; google-ai-overview 3,330; generation_inherit 2,197; … deprecated-staggered-split 644 — likely all junk; tgp_solutions 1,500 — width-first strings).
- `oem_wheel_sizes` has **15 shapes**: obj:axle 22,700 · {width,diameter} 3,404 · strings 3,369 · {width,offset,diameter} 3,257 · obj:position 2,260 · **bare string (not array) 849** · {front_width,rear_width} 325 · misc <100 each. `oem_tire_sizes`: array 34,927 · {front,rear} 1,268 · bare string 142.
- Make slugs are dirty: `mercedes` (1,279) AND `mercedes-benz` (1,678); `chevrolet vans`, `ford minivans`, `ram vans`, etc. as separate makes (~100 rows).
- 30 rows with empty bolt_pattern.

## Sources (approved)
| Source | Use | Access |
|---|---|---|
| NHTSA vPIC (`vpic.nhtsa.dot.gov/api`) | what Y/M/M existed in US; body class | free, public domain |
| EPA fueleconomy.gov (`/ws/rest/vehicle/menu/*`) | trim/engine list per Y/M/M | free, public domain |
| US AutoForce `GetVehicleOptions` | OE tire sizes per Y/M/M/option | customer; admin route `/api/admin/usaf-vehicle?action=compare&year&make&model`; client `src/lib/usautoforce/client.ts` |
| WheelPros vehicle fitment | bolt/CB/OE wheel size/offset | dealer; **their YMM lookup is mid-change — expect churn**; `src/lib/wheelpros/auditClient.ts` |
| OEM press kits / owner's manuals / spec PDFs | trim-level wheel+tire | free; record URL per generation |
| tiresize.com | spot-check only | 15/hr, 75/day (fitment-research/throttle-state.json) |
| **wheel-size.com, simpletire, tirerack, discounttire** | **BANNED** | — |

## Passes
### Pass 0 — Structural integrity (SQL only, no external calls)
Flag (never auto-fix): duplicate trims per Y/M/M; junk trim names (`Front|Rear|, |catch-all`); wheel strings width-first (`8x18`); non-array/bare-string wheel/tire fields; tire rim ≠ any wheel diameter; empty bolt pattern; bolt pattern or CB changing within a model generation without a known platform change; offsets outside −76..+70; CB implausible for bolt family; `deprecated-*` sources still active; make-slug variants (`mercedes` vs `mercedes-benz`, `* vans/minivans`). **Also:** add `quarantined_at IS NULL` filter to `src/lib/fitment/universalFitmentResolver.ts` (site side has the same leak as the API had).
**Output:** `docs/fitment-api/audit/pass0-structural.md` + `scripts/audit/pass0/*.sql|mjs` + a normalization proposal for ONE canonical `oem_wheel_sizes` shape (`{axle:'square'|'front'|'rear', diameter, width, offset|null, tireSize|null}`) with a dry-run migration.

### Pass 1 — Existence & coverage (NHTSA + EPA)
For every active Y/M/M: does NHTSA list it as sold in the US? → not listed = **phantom candidate**. For every NHTSA Y/M/M 1990–2026 (passenger car, MPV, truck ≤ class 2b): do we have it? → missing = **gap list**. For every EPA trim/engine per Y/M/M 2000–2026: do we have a matching trim? → **trim gap list**.
**Output:** `pass1-existence.md` with honest coverage % by decade + CSVs of phantoms/gaps/trim-gaps.

### Pass 2 — Tire sizes (USAF)
Every active row 2000–2026 (then 1990s): `oem_tire_sizes` vs USAF GetVehicleOptions for that Y/M/M (+ option/trim match). Exact match → `tire_verified`. Mismatch → flagged with both values. USAF trim names also cross-check Pass 1. Respect rate: batch, cache responses to `scripts/audit/pass2/cache/`.
**Output:** `pass2-tires.md`, per-row results table `audit_tire_results` (new table, not a mutation of vehicle_fitments).

### Pass 3 — Wheel specs per platform generation
Group rows into platform generations (make+model+year-range where bolt/CB/thread constant). ~1,500 groups. For each: verify bolt pattern, CB, thread, seat, OE wheel sizes+offsets via WheelPros → OEM docs. **Every certified generation records a source URL.** No URL = stays `unverified`.
**Output:** `pass3-wheels.md`, `audit_generation_sources` table.

### Pass 4 — Human residue
Everything still flagged → CSV for Scott / counter staff. Target: low hundreds.

## Rules for all passes
- Children **flag, parent applies.** Data mutations/quarantines only via reviewed scripts run by the parent (pattern: `scripts/apply-reddit-fitment-fixes.mjs` — dry-run default, `--apply`, `audit_original_data` snapshot, `last_modified_by/reason`).
- Never `DELETE`. Quarantine = `quarantined_at`.
- Results go in new `audit_*` tables or CSV/MD under `docs/fitment-api/audit/` — never overwrite `certification_status` until the parent runs the final certification script.
- Final state per row: `certification_status ∈ {certified, flagged, quarantined, unverified}`, `certified_at`, `certified_by_script_version = 'audit-2026-09'`, and a source reference. API exposes `confidence` derived from this.
- Coverage priority: 2000–2026 → 1990s → pre-1990 (kept, `confidence: low`).

## Subagent operating rules (from skill parallel-subagent-fanout)
- model `anthropic/claude-fable-5-1`, `visible:true`, group `fitment-audit`, `context:"isolated"`.
- Brief contains the shared facts (this doc + `memory-temp/audit-shared-facts.txt`), the exact write scope, and: **Do NOT write to memory/, memory-temp/, MEMORY.md or any daily log. Do NOT git commit or push.**
- Parent reads results via `sessions_history`, reviews, commits.

## Status log
- 2026-09-15 09:55 — plan written; Pass 0 + Pass 1 children spawning.
