# Fitment DB Audit — Pass 0: Structural Integrity

**Run:** 2026-09-15 · **Scope:** 36,337 active rows of `vehicle_fitments` (`quarantined_at IS NULL`) · **External calls:** none.
**Artifacts:** `scripts/audit/pass0/{00-create-flags-table,01-run-checks,02-normalize-wheels-dryrun,_lib}.mjs`, tables `audit_pass0_flags` (55,507 flags) + `audit_pass0_rows` (normalized derivation of every active row), `scripts/audit/pass0/out/{summary,normalize-dryrun,normalize-failures}.json`.
**Nothing in `vehicle_fitments` was modified.**

## 1. Headline numbers

| | rows | % of active |
|---|---|---|
| rows with ≥1 **error** | **9,844** | 27.1% |
| rows with ≥1 warn | 16,602 | 45.7% |
| rows with any flag (incl. info) | 28,863 | 79.4% |
| rows with an error that is NOT mechanically fixable by a script (dup/junk trim, rim mismatch, empty bolt, destroyed wheel data) | 3,638 | 10.0% |

Rows with ≥1 error by source (top): `deprecated-staggered-split` 644/644 (100%), `oem_specs` 142/142 (100%), `manual_seed_spec*` 462/585 (79%), `api_import [expanded]` 587/863 (68%), `api_import` 311/493 (63%), `generation-baseline*` 795/1,328 (60%), `cache-import*` 3,151/7,325 (43%), `generation_inherit` 610/2,197 (28%), `trim-research` 475/4,994 (9.5%), `google-ai-overview` 241/3,330 (7.2%), `tgp_solutions` 126/1,500 (8.4%).

## 2. Flags by check

| check | severity | flags | what it means |
|---|---|---|---|
| wheel_axle_front_only | error | 5,457 | every wheel entry is `axle:'front'`, no rear/both → square fitment mislabelled |
| dup_trim_per_ymm | error / warn | 2,907 / 462 | same Y/M/M/display_trim >1 row; error = specs differ, warn = identical copies |
| wheel_not_array | error | 849 | `oem_wheel_sizes` is a jsonb *string* containing JSON (double-encoded) |
| junk_trim_name | error / warn / info | 670 / 2,730 / 2,483 | error = `Front`/`Rear` in trim; warn = comma catch-all ("S, SV, SL"); info = `Base` beside real trims (2,357) / trim==model (126) |
| deprecated_source_active | error | 644 | `source LIKE 'deprecated%'` still active |
| tire_not_array | error | 142 | `oem_tire_sizes` double-encoded (all `oem_specs` source) |
| wheel_object_stringified | error | 40 | wheel entries are the literal string `"[object Object]"` — data destroyed at import |
| empty_bolt_pattern | error | 30 | 20 deprecated-split + 6 merged-staggered + 4 tgp (all center-lock Porsche/Lambo/Lotus) |
| tire_rim_mismatch | error / warn | 14 / 1,323 | error = no tire rim matches any wheel (1953–66 F-100: tires 16", wheels 15"); warn = tires list a diameter with no wheel (1,311 of them have *more* tire rims than wheels) |
| wheel_unparseable | error | 1 | `[]` empty array |
| missing_core_fields | warn | 5,423 | seat_type null 5,342 · thread_size null 1,255 · CB null 56 · wheels empty 48 · tires empty 6 |
| thread_size_nonstandard | warn | 3,054 | 19 spellings of 6 values (`M12x1.50`, `M14 x 1.5`, `M14x1.50B`…) |
| wheel_string_width_first | warn | 2,886 | `"7.5x18"` / `"8Jx17"` strings (width first) — the resolver reads these as diameter 0 |
| seat_type_nonstandard | warn | 2,298 | `Conical` 1,417 · `Lug nuts` 826 · `Ball` 48 · `Lug bolts` 7 |
| make_slug_variant | warn | 1,382 | `mercedes` 1,279 + 16 `<make> vans/minivans` slugs (103 rows) |
| staggered_inconsistent | warn / info | 676 / 5,303 | warn = tires `{front,rear}` but wheels all square (644 deprecated + 26 tgp + 6 inherit); info = wheels front/rear but tires flat |
| wheel_dims_implausible | warn | 612 | `width:null` objects (verified-research), diameter-only strings, width ranges `"8-9x20"` |
| wheel_mixed_types | warn | 529 | strings and objects in the same array |
| cb_implausible | warn | 94 | see §5 |
| wheel_dropped_keys | warn | 54 | per-entry `notes`/`trim` keys (Barracuda, Escort, Supra…) that the canonical shape cannot hold |
| tire_axle_suffix | warn | 34 | `"245/40R19 front"` strings inside a flat array (33 = `batch5-sports-more`) |
| offset_out_of_range | warn / info | 8 / 19 | warn = Porsche 911 rear +76 (deprecated rows), Transit 350HD DRW +109; info = HD 8-lug/DRW +130s (real) |
| wheel_shape_nonstandard | info | 13,637 | anything other than `obj:axle` (15 shapes, see §6) |
| cert_status_non_certified_active | info | 815 | `deprecated-superseded-by-canonical` 624 · `needs_review` 161 · `center_lock_unsupported` 30 — invisible to the site but still "active" |
| bolt_or_cb_changes_within_run | info | 671 | bolt/CB set changes between consecutive model-years (596 with gap 1yr; **311 are CB-only flips on the same bolt pattern** — e.g. NSX 64.1→70.0→64.1→70.1→70.5 2017–23; Audi A8 66.6→57.1→66.5→66.6 1999–2006) |
| phantom_year_hint | info | 260 | 248 single-year models, 12 isolated years; **0 rows outside 1940–2026** |
| bolt_pattern_malformed, tire_unparseable, tire_double_encoded | — | 0 | clean |

Re-run any single check: `node --env-file=.env.local scripts/audit/pass0/01-run-checks.mjs --skip-load --only=<check_name>`.

## 3. Top offenders (error+warn flags)

Makes: chevrolet 788e/2,238w · bmw 828e/1,297w · subaru 757e/247w · volkswagen 580e/280w · mitsubishi 481e/166w · ram 456e/1,002w · kia 452e/253w · mercedes 443e/1,289w · toyota 438e/1,307w · ford 406e/1,350w.
Models: jeep grand-cherokee 286e · ram 2500 203e · toyota tacoma 168e · subaru forester 162e · ram 3500 161e · nissan titan 152e · porsche 911 148e/371w · vw jetta 144e · subaru outback 140e · mini cooper 138e.

### Worst 30 rows (by error count, then warns)
All 30 are `deprecated-staggered-split` rows from MY2018 — center-lock Porsche 911 variants, Lotus Evora, BMW 7-series, Karma Revero, Audi RS3, Sprinter 3500XD — each carrying 8 flags (`deprecated_source_active, junk_trim_name, empty_bolt_pattern|cb_implausible, missing_core_fields, staggered_inconsistent, wheel_shape_nonstandard, wheel_string_width_first, cert_status_non_certified_active`). Full list with ids: `out/summary.json → worstRows`. First 10 ids:
`e718cd3f-8873-4543-b684-7981f317bb2a, 437f686c-bca9-4b7e-8fd8-8f70f629887f, b4126e77-8581-44d1-90d8-d6e543263662, e560d9f6-6299-45d4-ba79-c8dc38039d43, efb8c63d-45cb-48c0-a40b-d5deddcdd96d, 4c59c587-11b4-4736-961c-949c496b4870, 9b23716a-ecfc-4b4a-865c-f55845503581, a541f9be-c1b5-4398-81e4-17372d454ae8, d74a5a6a-b88e-4182-94ae-1d979d5af32c, dc688a7f-d86e-47bd-a5d0-f22afda38096`.
Quarantining the 644 `deprecated-staggered-split` rows clears the entire worst-30 list.

## 4. The five findings that matter

1. **5,457 rows are square fitments mislabelled `axle:'front'`** (every entry front, zero rear/both). Sources: `cache-import*` 2,850, `generation-baseline*` 812, `api_import*` 1,024, `manual_seed_spec*` 462, others. `/api/wheels/fitment-search` (`route.ts:275 bothSpecs = filter(axle==="both")`) and `vehicleFitment.ts:563` see these as staggered-with-no-rear. Mechanically fixable; the normalizer in §6 relabels them `square`.
2. **The site resolver reads wheel data for ~13,600 rows as diameter 0.** `universalFitmentResolver.ts:679` does `ws.diameter || 0` on the raw jsonb — strings (2,840 + 142), `{d,o,w}`, `front_width`, `size`, `{front:{},rear:{}}`, and the 849 double-encoded rows all produce `[{diameter:0,width:0}]`. Normalizing to one shape fixes it without a code change.
3. **1,445 Y/M/M/trim groups (3,369 rows) are duplicated, 2,907 rows with conflicting specs.** Every group has distinct `modification_id`s → they are import collisions, not copies: `verified-research` vs `api_import [template:ram_hd…]` (Ram 2500/3500 2025), `catalog-gap-fill` vs `google-ai-overview`, `merged-staggered` vs `tgp_solutions` (200), plus 222 self-duplicates inside `trim-research`. `Base` is the label in 1,122. Some carry wrong labels outright (2000 GMC Yukon: `modification_id=gmc-yukon-denali-ultimate-…` with `display_trim=SLT`). Needs Pass 3 arbitration, not a script.
4. **1,003 rows have structurally destroyed or unrecoverable data:** 849 double-encoded wheel strings (recoverable by JSON.parse — the converter handles all 849), 142 double-encoded tire strings (recoverable), **40 rows whose wheels are `"[object Object]"`** (Chevy Express 2500 ×23, Ram ProMaster ×12, Bolt EV/EUV ×4, Camaro ×1 — unrecoverable, need re-research), 30 empty bolt patterns (center-lock cars).
5. **`deprecated-staggered-split` (644 rows) is 100% junk** and should be quarantined wholesale: every row has `Front`/`Rear` baked into the trim name, `certification_status='deprecated-superseded-by-canonical'`, tires `{front,rear}` against a single square wheel. 26 more rows of the same "X Front X" pattern live in `tgp_solutions` (2018 Audi R8, Lamborghini Aventador/Huracán) and need the same treatment.

## 5. Center-bore outliers (94 rows, `cb_implausible`)

| bolt | CB | rows | example | verdict |
|---|---|---|---|---|
| 5x112 | 72.6 | 39 | bmw 740e-xdrive (G11/G12) | wrong — BMW 5x112 hub is 66.6; 72.6 is the old 5x120 bore |
| 5x127 | 70.3 | 32 | cadillac deville | wrong — 70.3 is Cadillac's 5x115 bore; 5x127 should be 71.5 |
| 5x120.65 | 57.1 | 8 | buick skylark | wrong — GM 5x4.75 bore is 70.3; 57.1 is VW |
| 5x139.7 | 71.6 | 6 | dodge ramcharger | wrong — Dodge 5x5.5 bore is 77.8/108 |
| 5x130 | 67.1 | 6 | karma revero | suspect |
| 5x130 | 71.0 | 2 | bentley mulsanne | plausible-ish (Porsche/Bentley 71.6) |
| 5x139.7 | 64.1 | 1 | rivian r1t | bolt pattern is wrong (R1T is 6x139.7) |

Infiniti QX80 6x139.7/77.8 (224 rows) was initially flagged and is correct (Nissan bore); range widened.

## 6. Wheel-shape normalization plan (`02-normalize-wheels-dryrun.mjs`)

**Canonical:** `oem_wheel_sizes = [{axle:'square'|'front'|'rear', diameter, width|null, offset|null, tireSize|null, isStock}]`, `oem_tire_sizes = ["245/40R19", …]` (flat, unique; staggered front/rear preserved via `wheels[].tireSize`).

Two deliberate deviations from the brief, for the parent to accept or reject:
- **`isStock` is kept.** `fitment-search` picks the stock spec with `isStock !== false`; 640 of the double-encoded rows carry plus-size options (`14" stock + 15–20" isStock:false`) that would otherwise be promoted to OE.
- **`square` (brief) instead of `both` (what the readers emit today).** Four readers compare `axle === "both"` and need a one-line alias before `--apply`: `src/app/api/wheels/fitment-search/route.ts:275`, `src/lib/vehicleFitment.ts:563`, `src/lib/api/public-fitment-service.ts:219`, `src/lib/fitment/geometryValidator.ts:206`. Alternative: emit `both` (change one constant in `_lib.mjs AXLE()`); zero code changes then.

Dry-run result over 36,337 rows: **already canonical 788 · convertible 35,509 · cannot convert 40** (the `[object Object]` rows).

| raw shape | rows | convertible | notes |
|---|---|---|---|
| obj:axle | 22,700 | 22,700 | `both`→`square`; `axle:'both'+position:'front'` → position wins; 5,457 front-only rows relabelled square |
| obj:width,diameter | 3,404 | 3,404 | square, offset null |
| obj:width,offset,diameter | 3,257 | 3,257 | |
| strings | 2,840 | 2,800 | `7.5x18`/`8Jx17`/`18x8`/`8-9x20` (range → two entries); 40 blocked |
| obj:position | 2,260 | 2,260 | |
| not-array:string (double-encoded) | 849 | 849 | JSON.parse then route by inner shape (obj:axle 649, strings 142, obj:position 53, obj:w,o,d 5) |
| mixed strings+objects | 529 | 529 | |
| obj:front_width/rear_width | 325 | 325 | → front + rear entries, same diameter |
| obj:size,tires,offset | 86 | 86 | `tireSize` attached when the entry has exactly one tire |
| obj:{front:{},rear:{}} | 36 | 36 | |
| boltPattern / d,o,w / isStaggered / notes / trim / staggered / empty | 51 | 51 | `notes`/`trim` per-entry keys dropped (54 rows flagged `wheel_dropped_keys`; originals kept in `audit_original_data`) |

Tire side: 34,927 arrays, 1,268 `{front,rear}` (flattened; front/rear attached to wheels by rim), 142 double-encoded (decoded). All 3 before/after examples per shape are in the script output and `out/normalize-dryrun.json`.

## 7. Make-slug consolidation plan

| current | rows | → winner | rationale |
|---|---|---|---|
| `mercedes` | 1,279 | `mercedes-benz` (1,678) | larger, matches `MAKE_ALIASES` normalization already in the resolver |
| `toyota minivans` 13, `nissan vans` 11, `ford vans` 10, `ford minivans` 9, `chrysler minivans` 9, `mercedes-benz vans` 7, `gmc vans` 6, `chevrolet vans` 6, `ram minivans` 6, `kia minivans` 5, `honda minivans` 5, `ram vans` 5, `dodge minivans` 4, `nissan minivans` 3, `mercedes-benz minivans` 2, `chevrolet minivans` 2 | 103 | strip ` vans`/` minivans` | the model slug already carries the body (sienna, transit-350-hd, sprinter-3500xd) |

Before merging `mercedes`→`mercedes-benz`, re-run `dup_trim_per_ymm` on the union — the two slugs almost certainly overlap on Y/M/M/trim (they were flagged separately here because the check groups on exact make).

## 8. Site-side fix applied (uncommitted)

`src/lib/fitment/universalFitmentResolver.ts` — `CERTIFIED_FILTER` is now `and(eq(certificationStatus,'certified'), isNull(quarantinedAt))`.
`src/lib/fitment/canonicalResolver.ts` (helper the resolver calls for canonicalFitmentId reverse-mapping) — `isNull(vehicleFitments.quarantinedAt)` added to all 4 certified lookups and to the by-id mapping lookup.
`npx tsc --noEmit -p tsconfig.json` → exit 0, no errors. `git diff --stat`: 2 files, +19/−9.

## 9. Parent should apply — in this order

| # | action | script / method | rows |
|---|---|---|---|
| 1 | Commit the resolver quarantine filter (§8) | `git add src/lib/fitment/universalFitmentResolver.ts src/lib/fitment/canonicalResolver.ts` | — |
| 2 | Quarantine all `source='deprecated-staggered-split'` + the 26 `tgp_solutions` "X Front X / X Rear X" rows | new apply script (pattern: `apply-reddit-fitment-fixes.mjs`); ids: `SELECT fitment_id FROM audit_pass0_flags WHERE check_name='junk_trim_name' AND severity='error'` | 670 |
| 3 | Quarantine the 40 `[object Object]` rows and re-research them in Pass 3 | `SELECT fitment_id FROM audit_pass0_flags WHERE check_name='wheel_object_stringified'` | 40 |
| 4 | Decide `square` vs `both`; add reader alias if `square`; then run `02-normalize-wheels-dryrun.mjs --apply` | fixes findings 1 & 2, removes 13,637 shape flags, 849+142 double-encoding, 2,886 width-first strings, 529 mixed arrays, 5,457 front-only | 35,509 |
| 5 | Normalize `thread_size` (19→6 spellings) and `seat_type` (`Conical`→`conical`, `Ball`→`ball`, `Lug nuts`/`Lug bolts`→NULL) | SQL from `detail->>'proposed'` in `audit_pass0_flags` | 3,054 + 2,298 |
| 6 | Merge make slugs (§7), then re-run `dup_trim_per_ymm` | `detail->>'proposed'` | 1,382 |
| 7 | Quarantine or delete-by-quarantine the 462 identical-spec duplicates (keep lowest `created`/preferred source) | `SELECT detail->'ids' … WHERE check_name='dup_trim_per_ymm' AND severity='warn'` | 462 |
| 8 | Hand to Pass 3: 2,907 conflicting duplicates, 94 CB outliers, 311 CB-only year flips, 1,323 tire-rim-without-wheel rows, 2,730 comma catch-all trims, 14 F-100 rim errors | `audit_pass0_flags` | — |
| 9 | Decide fate of 815 active-but-uncertified rows (`needs_review` 161 may be real data) | `check_name='cert_status_non_certified_active'` | 815 |

Do not run step 4 before step 2: the deprecated rows would be "normalized" and look healthier than they are.
