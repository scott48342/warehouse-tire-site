# Pass 3a — 1990s Volume-Truck Gap Fill (sourced research → insert proposals) — 2026-09-15

**Nothing in `vehicle_fitments` was modified.** Deliverables: `docs/fitment-api/audit/pass3a/proposals.json` (110 rows), `scripts/audit/pass3a/apply-proposals.mjs` (dry-run default; `--apply` inserts, parent only), `scripts/audit/pass3a/build-proposals.mjs` (regenerates proposals.json from the generation specs below — edit there, not the JSON). All fetched pages/PDFs are cached in `scripts/audit/pass3a/cache/`.

## Scope reality check (vs. the brief)
Queried the DB first (`00-inspect.mjs`, `01-years.mjs`). Of the 7 scope items, only these are **true zero-row gaps**:

| Gap | Status |
|---|---|
| Ford F-150 1992–1999 | ✅ proposed (20 rows) |
| Ford Ranger 1993–1999 | ✅ proposed (18 rows) |
| Ford F-250 / F-350 1991–1999 | ✅ proposed (12 + 16 rows) — **no MY1998 F-350 / OBS F-250 HD exists** (see gotchas) |
| Chevrolet Suburban 1992–1999 | ✅ proposed (24 rows, OEM-sourced) |
| Toyota Camry 1992–1999 | ⚠️ 1992–1996 proposed (20 rows); **1997–1999 unresolved** (tiresize throttle) |
| Toyota 4Runner 1991–1999 | ❌ **unresolved** (tiresize throttle) |
| GM C/K 1500/2500/3500 1990–99, Dodge Ram 1994–99, Tacoma 1995–99, Tahoe 1992–99, GMC Yukon 1992–99 | **Already have rows** — not gaps. But see "Existing-row problems found in passing". |

Slugs reused as-is: `chevrolet/suburban`, `ford/f-150`, `ford/f-250`, `ford/f-350`, `ford/ranger`, `toyota/camry`. No new model slugs needed. 1999 Super Duty goes under `f-250`/`f-350` with `display_trim` "Super Duty …" (the DB already has `f-250-super-duty`/`f-350-super-duty` as 2018-only junk slugs — do not extend those).

## Sources actually used
| Source | Type | Used for |
|---|---|---|
| **GM Heritage Archive Vehicle Information Kits** — `https://www.gm.com/content/dam/company/no_search/heritage-archive-docs/vehicle-information-kits/chevrolet/<YEAR>-Chevrolet-Suburban.pdf` (1992–1999 all downloaded; scanned, no text layer — read visually) | **OEM** | Suburban tires (RPO codes per series), wheel sizes, bolt holes/circle, offsets |
| GM VIK `chevrolet-trucks/1995-Chevrolet-Truck.pdf` (C/K pickup tech guide) | OEM | corroboration: C10906 6800 GVW→P235/75R15, 7700 GVW→LT245/75R16 |
| tiresize.com year pages `https://tiresize.com/tires/<Make>/<Model>/<Year>/` (15 fetched, log in `cache/tiresize-log.json`) | secondary | OE tire sizes per body/drive for Ford + Camry 1992 |
| TheRangerStation Ranger Wheel Fitment Guide | enthusiast (corroboration) | Ranger 5x4.5, factory 14x6 / 15x7 |
| Wikipedia F-Series 10th gen, Super Duty, Camry XV10 | index only | model-year ranges, platform boundaries |
| **Not usable:** WheelPros `auditClient.ts` (bolt-pattern product search, no YMM OE lookup); Ford Heritage Vault (session-bound JS app, search 404s server-side); Ford owner-manual PDFs (URL scheme unknown, 404); pressroom.toyota.com (403 Cloudflare); web_search tool (no provider). `fitment-research/cache/*` is unsourced `generation_inheritance` and wrong for these vehicles (1997 F-150 "6x135"+17", 1997 4Runner 17", Suburban pointing at Tahoe.json) — not used. |

tiresize.com budget: **15 of 15/hr used (first query 10:05 EDT → resets ~11:05), 15/75 today.** Throttle state lives in `F:\clawd\fitment-research\throttle-state.json` (outside my write scope — parent should add 15 queries to `tiresize.com`).

## Generation spec tables

### Chevrolet Suburban 1992–1999 (GMT400) — confidence **HIGH** (OEM)
| display_trim | bolt | CB | thread | OE wheel | OE tires | Notes |
|---|---|---|---|---|---|---|
| 1500 2WD (C10906) | **5x127** | 78.1* | M14x1.5* | 15x7 (+0, GM 1992 tech guide) | P235/75R15 (QHA/QHM); LT245/75R16E w/ L65 diesel (QIZ) | N90 15x7 aluminum opt |
| 1500 4WD (K10906) | 6x139.7 | 78.1* | M14x1.5* | 16x6.5 (GM doc "50 mm" — see gotcha); PF4 16x7 alum opt | LT245/75R16C (QBN/QBX), LT245/75R16E (QIW/QIZ), **P245/75R16 (QGA/QGB) from MY1996**; LT225/75R16D listed 1992 | |
| 2500 (C/K20906) | 8x165.1 | 116.7* | M14x1.5* | 16x6.5 (GM doc "17 mm") | LT245/75R16E (QIZ std, QIW on/off-road) | 2WD/4WD identical → one row |
\* CB/thread not printed in the kits; standard GMT400 values, corroborated by existing sibling rows from other source families.
Page-verified years: 1992 (tech guide Wheels & Tires table p.11), 1995 (order guide p.7/p.12, tech guide p.81/85), 1996 (p.7), 1997 (p.7/12), 1999 (order guide p.7/12 + product info guide p.13). 1993/1994/1998 kits downloaded (same RPOs bracketed) but not page-read.

### Ford F-150 1992–1996 (9th gen "OBS") — confidence **LOW** (tiresize only)
| trim | bolt | CB | thread | wheels | tires |
|---|---|---|---|---|---|
| 2WD | 5x139.7 | 87.1 | 1/2-20 | 15x6.5, 15x7 | P215/75R15, P235/75R15 |
| 4WD | 5x139.7 | 87.1 | 1/2-20 | 15x7 | P235/75R15 (+P265/75R15 1996) |
| Lightning 1993–95 | 5x139.7 | 87.1 | 1/2-20 | 17x8 | P275/60R17 |
Not proposed (unsourced): LT235/85R16 HD-payload 16x7 option.

### Ford F-150 1997–1999 (10th gen PN-96) — confidence **LOW**
| trim | bolt | CB | thread | wheels | tires |
|---|---|---|---|---|---|
| 2WD | **5x135** | 87.1 | M14x2.0 | 16x7 | P235/70R16, P255/70R16 |
| 4WD | 5x135 | 87.1 | M14x2.0 | 16x7, 17x7.5 | P235/70R16, P255/70R16, P265/70R17 (+P275/60R17 in 1999) |
| Lightning 1999 | 5x135 | 87.1 | M14x2.0 | 18x9.5 | P295/45ZR18 |

### Ford Ranger 1993–1999 — confidence **MEDIUM** (tiresize + TheRangerStation)
| trim | bolt | CB | thread | wheels | tires |
|---|---|---|---|---|---|
| 2WD 1993–97 | 5x114.3 | 70.6 | 1/2-20 | 14x6 | P195/70R14, P215/70R14, P225/70R14 |
| 2WD 1998–99 | 5x114.3 | 70.6 | 1/2-20 | 14x6, 15x7 | P205/75R14, P225/70R15 |
| 4WD 1993–99 | 5x114.3 | 70.6 | 1/2-20 | 15x7 | P215/75R15, P225/75R15, P235/75R15 (+P265/70R15 1993–95) |
| Splash 2WD 1995–98 | 5x114.3 | 70.6 | 1/2-20 | 15x7 | P235/60R15 |

### Ford F-250 / F-350 — confidence **LOW**
| gen | trim | bolt | CB | thread | wheels | tires |
|---|---|---|---|---|---|---|
| F-250 OBS 1991–1997 | Base (2WD/4WD identical) | 8x165.1 | 121.3 | 9/16-18 | 16x6, 16x7 | LT215/85R16, LT235/85R16 |
| F-350 OBS 1991–1997 | SRW | 8x165.1 | 121.3 | 9/16-18 | 16x7 | LT235/85R16, LT215/85R16 |
| F-350 OBS 1991–1997 | DRW | 8x165.1 | 121.3 | 9/16-18 | 16x6 | LT215/85R16, LT235/85R16 |
| F-250 Light Duty 1997–1999 | Light Duty | **7x150** | 121.3 | M14x2.0 | 16x7 | P255/70R16, LT245/75R16 |
| F-250 Super Duty 1999 | Super Duty 2WD / 4WD | **8x170** | 124.9 | M14x2.0 | 16x7 | LT235/85R16 (+LT265/75R16 4WD) |
| F-350 Super Duty 1999 | Super Duty SRW | 8x170 | 124.9 | M14x2.0 | 16x7 | LT265/75R16 |
| F-350 Super Duty 1999 | Super Duty DRW | 8x170 | 124.9 | M14x2.0 | 16x6 | LT215/85R16 (2WD), LT235/85R16 (4WD) |

### Toyota Camry 1992–1996 (XV10) — confidence **LOW**
5x114.3 / CB 60.1 / M12x1.5. DX 14x5.5 P195/70R14; LE & XLE P195/70R14 (4-cyl) + P205/65R15 (V6); SE 15x6 P205/65R15. Rows per trim (DX/LE/XLE/SE).

## Gotchas (read before applying)
1. **GMT400 2WD 1500 is 5x127 (5x5"), 4WD 1500 is 6x139.7** — printed in the GM 1992 tech guide (5 holes / 5.0" circle for the 15" P235/75R15 wheel; 6 holes / 5.5" for 16"). The existing `chevrolet c1500` 1988–1999 rows say **6x139.7 — wrong for 2WD**; the `chevrolet c/k-1500` rows say 5x127 for all trims — wrong for K (4WD). Parent: flag both slugs for Pass 3 proper.
2. **GM "offset" column** in the 1992 tech guide reads 0 mm (15x7 5-lug), 50 mm (16x6.5 6-lug), 17 mm (16x6.5 8-lug), 127 mm (N67 rally 15x8). 50 mm on a 6.5" steel truck wheel is implausible as ET (independent sources put GMT400 K1500 16x6.5 at ≈+28–31); the 127 looks like a decimal slip. I stored the OEM figure only where it is uncontroversial (2WD 15x7 = 0) and left the 16" offsets `null`, with offset_min/max 0..31 matching sibling rows. Do not "correct" the DB to +50 from this doc.
3. **F-150 bolt pattern by year:** 1992–96 = 5x139.7 (5x5.5"); 1997–2003 = 5x135; 6x135 only from 2004. **Existing MY2000 `ford f-150` rows say 6x135 — wrong** (also list 20" tires). Flag.
4. **F-250 has THREE different bolt patterns in the 1990s:** OBS F-250/F-250 HD 1987–1997 = 8x165.1; **F-250 "Light Duty" 1997–1999 (10th-gen body, 7,700 GVWR) = 7x150 (7-lug)**; 1999 Super Duty = 8x170. tiresize labels the LD as "F250 Light" / "F250 2wd Pick-up" — do not merge those tire sizes into the SD rows.
5. **No MY1998 F-350 and no MY1998 OBS F-250 HD** (OBS HD line ended MY1997; Super Duty launched Jan 1998 as MY1999). The only 1998 F-250 is the 7-lug Light Duty. Pass 1's NHTSA-only 1998 gaps for these are VIN-pattern over-inclusion. Proposals reflect this (F-350: no 1998; F-250 1998: Light Duty only).
6. **Existing MY2000 `ford f-250`/`f-350` rows** list 17"/18" OE wheels and LT275/70R18 etc. — those are 2005+ Super Duty sizes; MY1999–2004 SD is 16" only. Flag.
7. **Existing `chevrolet tahoe` 1992–1994** rows exist with "High Country / RST / Premier" trims — Tahoe launched MY1995 (1992–94 was the full-size K5 Blazer) and those trims are 2015+. **`gmc yukon` 1992–1998 "Denali"** — Denali began MY1999. Both are Pass 1 phantom/junk-trim candidates that the matcher missed because the model exists in other years.
8. Ranger thread: 1/2-20 lug nuts (Ford light truck of the era). Existing `ford ranger` 1992 row says M12x1.5 and MY2000 rows say M12x1.75 — both look wrong; flag for Pass 3.
9. F-250/F-350 OBS CB stored as 121.3 mm; existing 1990 rows have 124.9 (the 8x170 value). Both are secondary — Pass 3 should confirm.
10. `display_trim` "Base" is used where 2WD/4WD fitment is identical so the selector auto-skips (single trim === Base rule in `SteppedVehicleSelector`).

## Unresolved (not proposed — no source in hand)
- **Toyota Camry 1997–1999 (XV20)** — need tiresize year pages 1997 & 1999 (2 queries) after 11:05 EDT; expected CE P195/70R14 (14x5.5), LE/XLE P205/65R15 (15x6), 5x114.3 / 60.1 / M12x1.5.
- **Toyota 4Runner 1991–1995 (N130)** and **1996–1999 (N180)** — need tiresize 1991, 1994, 1996, 1999 (4 queries); expected N130 15x7 P225/75R15 std / 31x10.50R15 (SR5 V6 4WD); N180 16x7 P225/75R16 / P265/70R16 (SR5 4WD, Limited); 6x139.7 / 106.1 / M12x1.5. Existing 1990 and 2000 rows bracket these.
- **F-150 LT235/85R16 HD payload option (1992–96), 1993 & 1995 Lightning pages, F-250 1997 HD vs LD split in tiresize** — single-secondary only; add second source to lift Ford rows from low→medium (candidate: Ford Heritage Vault brochures via a real browser session, or Ford owner-manual PDFs if the parent knows the fordservicecontent.com URL scheme).
- Bolt pattern / CB / thread for all Ford + Toyota rows are industry-standard values not printed in the fetched sources → that is why those rows are `low`/`medium` and insert as `certification_status='unverified'`.

## How to apply
```
node --env-file=.env.local scripts/audit/pass3a/apply-proposals.mjs                      # dry run (see summary below)
node --env-file=.env.local scripts/audit/pass3a/apply-proposals.mjs --apply               # all 110
node --env-file=.env.local scripts/audit/pass3a/apply-proposals.mjs --min-confidence=high --apply   # Suburban only (24 certified rows)
```
Inserted rows: `source='audit-2026-09-pass3-research'`, `quality_tier='complete'`, `is_locked=true`, `last_modified_by='clawd'`, `last_modified_reason='audit-2026-09 pass3a gap-fill: <generation> <first source url>'`, `certification_status='certified'`+`certified_at` only for `confidence=high` else `'unverified'`, `confidence_tag` HIGH/MEDIUM/LOW, `certified_by_script_version='audit-2026-09'`. Every insert is also logged to new table `audit_pass3a_inserts` (id → sources JSON).

### Dry-run output (2026-09-15 10:32 EDT)
```
DRY RUN — 110 proposals
  to insert: 110
    chevrolet suburban     rows= 24  years=1992-1999  conf={"high":24}
    ford f-150             rows= 20  years=1992-1999  conf={"low":20}
    ford f-250             rows= 12  years=1991-1999  conf={"low":12}
    ford f-350             rows= 16  years=1991-1997,1999  conf={"low":16}
    ford ranger            rows= 18  years=1993-1999  conf={"medium":18}
    toyota camry           rows= 20  years=1992-1996  conf={"low":20}
  certification: 24 certified (high) / 86 unverified (medium/low)
  SKIP dups: 0
```

## Files
- `docs/fitment-api/audit/pass3a/proposals.json`, `pass3a-gapfill.md` (this)
- `scripts/audit/pass3a/build-proposals.mjs` (generation specs → JSON), `apply-proposals.mjs`, `00-inspect.mjs`, `01-years.mjs`, `02-siblings.mjs` (DB read-only), `ts-fetch.mjs` (throttled tiresize fetcher + log), `ts-summ.mjs`, `pdf2txt.py`/`contact.py`/`render.py` (PyMuPDF page rendering for the scanned GM kits)
- `scripts/audit/pass3a/cache/` — 10 GM PDFs (+ rendered spec pages under `sub1992/`, `sub95/`, `sub1996/`, `sub1997/`, `sub1999/`, `trk95/`), 15 tiresize HTML pages, `tiresize-log.json`
