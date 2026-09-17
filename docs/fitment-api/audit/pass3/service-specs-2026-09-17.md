# Service specs from Tire Guide Pro prints — migration 0049 + backfill (2026-09-17)

Scott: "we should have already been storing this from the 120 PDFs." Tire Guide Pro prints carry lug torque, OE cold
inflation (front/rear) and the tire load index on every size line. Until today the parser captured them but the DB had
nowhere to put them.

## Schema — `drizzle/migrations/0049_fitment_service_specs.sql` (applied live 08:20 ET, before any code deploy)

| column | type | meaning | customer surface (TODO) |
|---|---|---|---|
| `lug_torque_ftlb` | integer | wheel lug nut torque | wheel PDP / install: "Torque: 150 ft-lb" |
| `tire_pressure_front_psi` | integer | OE placard cold pressure, front | tire PDP: "Recommended pressure 39/39 psi" |
| `tire_pressure_rear_psi` | integer | OE placard cold pressure, rear | |
| `oem_load_index` | integer | load index of the primary OE tire | tire PDP / replacement-tire guard (never sell below OE LI) |

All nullable, additive. Drizzle: `src/lib/fitment-db/schema.ts` (`lugTorqueFtlb`, `tirePressureFrontPsi`, `tirePressureRearPsi`, `oemLoadIndex`).
Applier: `scripts/apply-fitment-service-specs-migration.mjs` (already run — do not run again by hand; it is idempotent anyway).

## Parser bug found and fixed — `scripts/audit/pass3/tireguide/tg-parse.py`

The trailing numbers on a TG size line are positional: `[load index, torque, wheelbase]` right after the rim size. Prints
that list two wheelbases put the longer one **between** the Max Gross and Base weights. The parser pooled every 2–3 digit
integer on the line and took the last three, so on those prints the columns shifted by one — e.g. 2021 Silverado 1500
`load_index=157 torque=115 wheelbase=140` (157 is the crew/standard-box wheelbase; 115 is the real LI; the real torque, 140,
landed in wheelbase; the real wheelbase 147.5 fell into `_unparsed` because decimals were not accepted).

Fix: read the values positionally after the rim size (fallback: after the last weight/`Front:` token), accept decimal
wheelbases, and recognise run-flat sizes (`P255/45RF20`, which previously failed the tire regex and swept the front psi
into the number pool). Verified on the 24 PDFs still on disk (Ranger 100 ft-lb / LI 95 / wb 112 & 126 for Super Cab;
Silverado 140 / 115 / 147.5; Mach-E 150 / 103 / 117.5).

Wheel size, tire size, bolt circle, inflation and TPMS were **not** affected by the bug (different code path), so the
2026-09-16 reconcile's wheel/tire/bolt data stands.

## Backfill — `scripts/audit/pass3/tireguide/backfill-service-specs.mjs` (APPLIED 08:35 ET)

Only 24 of the ~120 PDFs still exist (the loop deletes them after parsing), so the 122 parsed JSONs in `out/` could not be
re-parsed. The shift is deterministic (decimal wheelbase in `_unparsed` **and** three ints parsed ⇒ shift left by one;
two ints with the first > 140 ⇒ `[2nd wheelbase, LI]`, no torque), so the script undoes it in memory and **validates the
repair against fresh parses of the 24 PDFs: 122/122 size lines agree**.

Row ↔ print mapping is exact: reconcile-tg.mjs wrote `raw_trim` = TG option names joined by ` | ` (staggered as
`X Front | X Rear`). Per row: torque = the trims' torque if they all agree (else NULL — torque is a safety spec, no
majority vote); front psi = mode over non-rear-axle lines; rear psi = mode over non-front-axle lines; LI = rank-1
front/both size matching `oem_tire_sizes[0]`. Sanity ranges (LI 60–140, torque 60–200, psi 20–90) drop garbage instead
of storing it.

| | |
|---|---|
| live `tireguide-pro` rows | 386 (106 Y/M/M) |
| rows updated | **363** — torque 329, front psi 359, rear psi 359, load index 363 |
| size lines where the parser shift was repaired | 186 |
| stored NULL torque on purpose | 2023 Challenger "R/T Scat Pack Widebody / SRT Hellcat …" (TG lists 130 for Scat Pack, 111 for the Hellcats) |
| not backfilled — no parsed JSON (rows entered by hand, `last_modified_by='clawd'`) | 1986 GMC Jimmy / S15 Jimmy, 1999 Discovery, 2023 Encore GX, 2023 Terrain, 2024–26 Maverick (23 rows) |
| Mach-E 2021–2026 (28 rows) | from Scott's 4 prints (`F:\clawd\tire-guide-pdfs\scott-YYYY-ford-mustang-mach-e.pdf` → `out/<year>/ford/mustang-mach-e.json`); 2025/2026 mirror 2024 per Scott ("2024 to current is all the same") |

Live spot checks: Mach-E 150 ft-lb, 39/39 (California Route 1, 2023 Select, Rally = 38/38, LI 104/105) — matches what
Scott read off Tire Guide; F-150 2024 150 ft-lb; Sierra 2500HD 140 ft-lb 60/70 psi LI 126; BMW XM 101 ft-lb 38/41.
Value ranges live: torque 80–162, LI 88–129, psi 30–80. Zero non-TG rows touched.

Run log: `scripts/audit/pass3/tireguide/out/backfill-service-specs-applied.json` (per-row values + validation).

Rollback: `update vehicle_fitments set lug_torque_ftlb = null, tire_pressure_front_psi = null, tire_pressure_rear_psi = null, oem_load_index = null where wheel_specs_source = 'tireguide-pro';`

## Going forward

- `reconcile-tg.mjs` now computes the same four values per TG trim (`serviceSpecs()`) and writes them on insert, so every
  future Tire Guide pass stores them automatically. Dry-run verified on 2024 Camaro (staggered) and 2024 Mach-E
  (`--retest --only=…`, transaction rolled back). `--retest` is dry-run only and ignored with `--apply`.
- The 23 hand-entered rows above need their prints (add to the TG worklist).
- Surface on PDP (wheel page torque, tire page pressure) and use `oem_load_index` as a floor in tire search — not started.
- Internal provenance rule unchanged: never expose `*_source` or name Tire Guide publicly.
