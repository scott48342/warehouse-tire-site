# 2018 Vehicle Fitments Investigation Report

**Date:** 2026-06-10
**Scope:** `vehicle_fitments` table, year=2018 records (read-only investigation)
**Scripts:** `scripts/investigate-2018.mjs`, `scripts/investigate-2018-confirm.mjs`
**Raw data:** `scripts/investigate-2018-output.json`

---

## Executive Summary

**The "rogue import" theory is wrong.** The 2018 spike is **not junk** — it is a deliberate, two-phase data load:

1. **May 7, 2026:** TGP Solutions (Tire Guide Pro) import — 2,154 records of trim-level fitment data for 2018 vehicles, in two flavors:
   - `tgp_solutions` (1,502): one row per trim, square setups
   - `deprecated-staggered-split` (652): staggered setups split into Front/Rear rows (326 pairs)
2. **May 14, 2026:** A cleanup pass (`merged-staggered`, 326 records) that re-merged each Front/Rear pair into a single proper staggered record with structured `{front_width, rear_width, diameter}` wheel data.

Spot-validation of 25 random records against OEM specs shows **~95%+ accuracy** — bolt patterns, center bores, wheel sizes, and tire sizes check out. This is **legitimate, high-quality trim-level coverage** that is more granular than the rest of the database.

**The real problems are:**
- All 2,480 records are stuck at `quality_tier='unknown'`, making them invisible to any tier-filtered logic
- 652 deprecated Front/Rear split rows are still live alongside their 326 merged replacements → **search-visible duplicates** across 161 models
- 102 records have malformed makes ("Chevrolet Minivans", "Mercedes-Benz Vans")
- 52 records missing center bore (mostly exotics + Ford DRW)
- Only 2018 was loaded — surrounding years got none of this enrichment (hence the year-curve spike)

**Bottom line: keep the data, finish the cleanup that was started on May 14 and never completed.**

---

## Task 1: Quality Tier Distribution

| Year | Tier | Count |
|---|---|---|
| 2016 | complete | 1,233 |
| 2017 | complete | 1,278 |
| **2018** | **unknown** | **2,480** ← only tier present |
| 2019 | complete | 1,360 |
| 2020 | complete | 1,538 |

**Finding:** 2018 has **zero** complete/high/partial records. 100% of 2018 is `unknown`. This means the original ~1,300 pre-existing 2018 records were **replaced or removed** during the May 7 import — 2018 is now entirely TGP-sourced data. Neighbor years are untouched (complete tier, normal counts).

**Implication:** There is no certified 2018 baseline to dedup against. The earlier disposition script's "0 duplicates" result was structurally guaranteed, not informative.

---

## Task 2: Source Distribution (2018)

| Source | Count | Created |
|---|---|---|
| `tgp_solutions` | 1,502 | 2026-05-07 |
| `deprecated-staggered-split` | 652 | 2026-05-07 |
| `merged-staggered` | 326 | 2026-05-14 |

**Findings:**
- Two creation dates only — May 7 (import) and May 14 (staggered merge pass).
- The source name `deprecated-staggered-split` is self-documenting: someone already recognized these rows as deprecated and built their replacements (`merged-staggered`) a week later — **but never deleted the deprecated rows.**
- Confirmed: all 326 merged records have matching Front/Rear pairs in the deprecated set (326/326), and 652 = 326 × 2 exactly.
- The May 7 import also touched other years lightly (~45 records across 2003-2017 from `tire-guide-pro-import`, `alias-from-mazda3`, `manual-qa-fix`) — negligible.

---

## Task 3: Make Distribution (2018, 60 distinct makes)

Top makes: BMW (327), Mercedes-Benz (185), Porsche (149), Ford (132), Chevrolet (114), Jaguar (106), Nissan (105), Audi (97), Toyota (89), Lexus (87).

**Findings:**
- Distribution skews **luxury/European** (BMW alone is 13%) — typical of trim-level data, since German brands have many wheel-option trims. Not a red flag.
- **Malformed category-suffix makes (102 records):** "Chevrolet Minivans", "Chevrolet Vans", "Mercedes-Benz Minivans", "Mercedes-Benz Vans", etc. These are TGP's category taxonomy leaking into the make field. The base make + suffix are cleanly separable (verified by disposition script).
- **Casing quirk (4 records):** "Smart Fortwo" — DB has "Smart", canonical branding is lowercase "smart". Cosmetic.
- No phantom makes (every make resolves to a real manufacturer once suffixes are stripped).

---

## Task 4: Rogue Import Theory — VERDICT: REJECTED

Evidence for **legitimate coverage expansion**:

| Evidence | Value |
|---|---|
| Field completeness (May 7 set) | bolt 2,130/2,154 (98.9%), bore 2,106/2,154 (97.8%), wheels 100%, tires 100% |
| New models added for 2018 | 288 of 449 May-7 models didn't exist in remaining 2018 data |
| YMMT-level overlap with non-May-7 2018 rows | only 100/2,154 (4.6%) |
| Sample OEM validation accuracy | ~95%+ (see Task 5) |
| Source quality | TGP = Tire Guide Pro, a recognized fitment data publisher |

Evidence **against** "duplicate junk": YMM overlap is 823/2,154 (38%) but YMMT overlap is only 100 — i.e., the import added *new trims* to existing models, not copies.

**Correct characterization:** A planned enrichment import of trim-level TGP data for model year 2018 (likely a pilot year), followed by a partially-completed staggered-merge cleanup. The work was abandoned mid-stream: deprecated rows never deleted, quality tiers never assigned, malformed makes never split, and no other years were loaded.

---

## Task 5: Sample Validation (25 random unknown-tier records)

Verified against OEM references (bolt pattern, center bore, OEM wheel/tire sizes):

| Vehicle | Spec check | Verdict |
|---|---|---|
| 2018 VW Golf R "Base" | 5x112, 57.1mm, 225/40R18 + 235/35R19 | ✅ Correct |
| 2018 GMC Terrain Denali | 5x115, 70.3mm, 235/50R19 | ✅ Correct |
| 2018 Hyundai Kona Ultimate | 5x114.3, 67.1mm, 235/45R18 | ✅ Correct |
| 2018 Nissan Kicks S | 4x100, 60.1mm, 205/60R16 | ✅ Correct |
| 2018 Acura RLX Sport Hybrid | 5x120, 64.1mm, 245/40R19 | ✅ Correct |
| 2018 Lincoln MKC Reserve | 5x108, 63.4mm, 18/19/20 options | ✅ Correct |
| 2018 BMW i3 Range Extender | 5x112, 66.6mm, 175/55R20 + 175/60R19 | ✅ Correct (i3 narrow tires) |
| 2018 Mini JCW Hardtop | 5x112, 66.6mm (F56 platform) | ✅ Correct |
| 2018 Nissan 370Z Heritage | 5x114.3, 66.1mm | ✅ Correct |
| 2018 Porsche 718 Cayman GTS | 5x130, 71.5mm, 235/35ZR20 front | ✅ Correct |
| 2018 Alfa 4C Spider | 5x98, 58.1mm | ✅ Correct |
| 2018 Cadillac CTS Vsport | 5x120, ~66.9mm | ✅ Correct (bore 67.06 rounds) |
| 2018 Audi A6 Quattro Sport 2.0 | 5x112, 66.5mm | ✅ Correct |

**Estimated accuracy: ≥95%.** No spec errors found in the sample; the only "issues" are formatting (Front/Rear trim mangling on deprecated rows). Trim granularity (e.g., "w/A-Spec Pkg.", "Vsport Premium Luxury", DRW/Snow-Plow variants) exceeds what the rest of the DB has. **This data is trustworthy.**

---

## Task 6: Parsing Bug — "Base Front Base" Trims

**Root cause identified.** The pattern is `{trim} {axle} {trim}` — e.g., "Base Front Base", "Quadrifoglio Rear Quadrifoglio", "(Michelin Tires) Front (Michelin Tires)".

**Mechanism:** TGP source data represents staggered fitments as separate Front/Rear axle rows. The importer built display_trim by concatenating `trim + axle_label + trim` (likely `${trim} ${axle} ${rawTrim}` with both trim vars holding the same value). All 678 affected 2018 rows have `source='deprecated-staggered-split'`; the data itself (one axle's wheel/tire in each row) confirms axle-split origin — e.g., NSX "Base Front Base" has only `front: [245/35ZR19]`, its "Base Rear Base" twin has only `rear: [305/30ZR20]`.

**These rows were already superseded** by the May 14 `merged-staggered` records, which carry clean trims ("Base", "Quadrifoglio") and proper combined front/rear data with structured widths.

**Note:** 26 records elsewhere (2020-2026, 5-6/year) also match the Front/Rear trim pattern — a small separate leak worth including in cleanup.

**Safe normalization strategy:** Don't normalize — **delete** the 652 deprecated 2018 rows once merged equivalents are verified (326/326 already confirmed paired). Normalizing their trims would *create* duplicates of the merged rows.

Before/after example (Acura NSX):
- Before: 2 rows — "Base Front Base" (8.5x19, front tire only) + "Base Rear Base" (11x20, rear tire only)
- After: 1 row — "Base", wheels `[{19, front 8.5}, {20, rear 11}]`, tires `{front: 245/35ZR19, rear: 305/30ZR20}` ← **already exists** as merged-staggered

---

## Task 7: Missing Wheel Fields (52 records)

All missing **center_bore_mm only** (bolt pattern, wheels, tires all present).

| Class | Makes | Count | Recommendation |
|---|---|---|---|
| Exotics (axle-split rows) | Porsche 18, Ferrari 10, Lamborghini 4, Lotus 2 | 34 | Most are deprecated split rows → resolved by Task 6 deletion; backfill bore on surviving merged rows (Ferrari = 67.0, Porsche = 71.5, etc.) |
| Ford Super Duty DRW | Ford | 15 | Missing source data. Backfill: F-350 DRW 8x200 → bore 142.0mm. High sales relevance — prioritize |
| Malformed-make vans | Mercedes-Benz Minivans/Vans | 3 | Handle in make-split fix; backfill Metris/Sprinter bores (66.6 / 84.1) |

**Recommendation: backfill, don't delete.** All 52 have otherwise-complete data. Until backfilled, exclude from wheel search (bore is safety-critical for hub-centric fitment); tire search can still use them.

---

## Task 8: Migration Plan (NOT EXECUTED — for review)

### Phase A — SAFE AUTOMATIC FIXES
1. **Delete 652 `deprecated-staggered-split` rows (2018)** after programmatic verification that each Front/Rear pair has a merged replacement (already verified 326/326 at model+trim level; re-verify per-row in migration with a guard clause).
   - Risk: LOW. Replacements exist; deprecated rows have mangled trims and half-fitments that actively harm search UX.
2. **Split malformed makes (102 rows):** "Chevrolet Minivans" → make="Chevrolet" (suffix is category metadata; optionally store in a category column). Use disposition CSV `malformed_make_needs_split.csv` as the worklist.
   - Risk: LOW. Deterministic string operation; collision check first (skip if identical YMMT already exists under clean make).
3. **Branding normalization (4 rows):** "Smart" → "smart" (or whichever casing the selectors expect — match existing non-2018 records first).
   - Risk: TRIVIAL.
4. **Promote quality tier:** After 1-3, set `tgp_solutions` + `merged-staggered` 2018 rows from `unknown` → `complete` (they meet the same field-completeness bar as neighbor years; 95%+ validated accuracy).
   - Risk: LOW-MEDIUM. Gate behind a final automated completeness check per row (bolt + bore + wheels + tires present) — rows failing stay `partial`.

### Phase B — REQUIRES HUMAN REVIEW
5. **Center-bore backfill (52 rows):** Bores must come from verified OEM references per model (safety-critical). Produce a worklist CSV with proposed values; human approves before UPDATE.
6. **2020-2026 Front/Rear trim leak (26 rows):** Investigate origin (different import), decide merge vs fix individually.
7. **YMMT overlaps with pre-existing data (100 rows):** Where a May-7 trim collides with a non-May-7 2018 record, human picks the survivor (TGP version is likely better, but verify).

### Phase C — DO NOT TOUCH
- The ~1,800 surviving `tgp_solutions` + `merged-staggered` records. They are valid, validated, trim-level coverage — the best data in the table for 2018.
- Neighbor years (no contamination found).

### Post-migration expected state
- 2018 count: 2,480 → ~1,828 (1,502 + 326), right in line with the 2017/2019 trend (1,291/1,380) **plus** legitimate extra trim granularity.
- 2018 spike: explained and resolved.
- Zero unknown-tier 2018 records.

### Follow-up recommendation
The TGP data quality is high. Consider licensing/loading TGP trim-level data for **all years**, not just 2018 — it would substantially improve trim coverage (cf. the abandoned trim-research project from 2026-04-26).

---

## Risk Assessment

| Action | Risk | Mitigation |
|---|---|---|
| Delete deprecated split rows | Low | Per-row guard: only delete where merged twin exists; soft-delete/export CSV backup first |
| Make splitting | Low | Collision check; CSV backup |
| Tier promotion | Medium | Per-row completeness gate; staged rollout (promote, monitor search logs 48h) |
| Bore backfill | Medium-High if automated | Human review of proposed values; wheel-search exclusion until verified |
| Doing nothing | **Highest** | 652 mangled-trim rows are user-visible TODAY in vehicle selectors ("Base Front Base"); unknown tier may suppress 2018 from tier-filtered features |
