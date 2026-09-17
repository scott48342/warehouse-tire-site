# Service-spec sourcing survey — lug torque, factory tire pressure, OE load index

**Date:** 2026-09-17 · **Question (Scott):** now that 363 Tire Guide rows give us a truth sample, find a reputable, legally clean source we can pull these three fields from at scale.

Internal document — source names in here never appear in public copy or API fields.

## TL;DR

1. **US AutoForce `GetVehicleOptions` already carries the exact fields.** Its per-OE-size response schema is `TireSize, LoadIndex, SpeedRate, FrontInf, RearInf, RimSize, WBC, TRQ1`. Load index and speed rating are **populated for every vehicle** and agree with Tire Guide on **294 of 300 comparable rows (98%)**. Front/rear inflation, bolt circle and torque are **present in the schema but blank on every row** (0 of 912) — the field names are Tire Guide's own vocabulary, so USAF is almost certainly licensing TCS data upstream and suppressing those columns on the eTailer API. One ask to our USAF rep could turn them on.
2. **Load index can be filled DB-wide today** from USAF, same provenance as the tire sizes we already took from them on 09-15 (distributor data under our dealer account). No new legal exposure.
3. **Torque and pressure**: no clean bulk source exists outside Tire Guide / its licensees. Paths, in order: (a) USAF enabling `FrontInf/RearInf/TRQ1`; (b) the TCS Tire Guide feed Scott requested 09-16, with redistribution terms in writing; (c) OEM owner's-manual transcription for spot-verification only (slow, no bulk access).

## Method

`scripts/audit/pass4/out/_grade-usaf-loadindex.mjs` (read-only): for every live row with `oem_load_index` set (363, all `tireguide-pro`), call USAF `GetVehicleOptions` for the Y/M/M, match on OE tire size, compare load index. Raw probe: `_usaf-raw-vehicle-options.mjs`. Output `_grade-usaf-loadindex.json`. Creds: `.env.local` (`node --env-file=.env.local …`).

| Result | Rows | Notes |
|---|---|---|
| match (single USAF value, equal) | 207 | |
| match among multiple | 87 | vehicle lists several OE sizes; our value is one of them (the trim's size) |
| mismatch | 1 | 2023 BMW XM: ours 108, USAF 107 (275/35R23) / 111 (315/30R23) — staggered; TG row carries a single value |
| no size match | 5 | our OE size string not in USAF's list |
| USAF vehicle not found | 63 | model-name spelling only: `silverado-2500hd`, `f-250`, `sierra-3500hd`, Audi `a7/a8/rs7/q6-e-tron/a5` — USAF uses "Silverado 2500 HD", "F-250 Super Duty", "A8 L" etc. Fix = alias table, not a data gap |

Populated counts across 912 USAF option rows: `LoadIndex` 912, `SpeedRate` 912, `FrontInf`/`RearInf` 0, `WBC` 0, `TRQ1` 0.

## Candidate sources

| Source | Fields | Legal posture | Scale | Verdict |
|---|---|---|---|---|
| **US AutoForce GetVehicleOptions** (SOAP, prod account 1381479) | LI + speed now; Inf/WBC/TRQ schema present, blank | Distributor data under our dealer agreement; same basis as tire sizes applied 09-15. Ask rep to confirm API-redistribution wording. | ~9k Y/M/M, seconds each, no model cost | **Use now for LI; request the blank columns** |
| **TCS / Tire Guide feed** (Scott called 09-16, awaiting email) | All three + bolt circle, TPMS | Clean only with written license covering public-API use | Full US market | **Primary long-term source if terms allow** |
| Tire Guide Pro prints via Tire Power counter (current 363) | All three | Subscription ToS via a third party's login; fine for our own shop use, thin for resale | ~20 s/vehicle, blocked by RDP redirection since 09-15 | Keep as verification; don't scale |
| OEM owner's manuals / door placard (Ford, GM, Toyota, Honda…) | All three, per trim | Cleanest possible (facts from the manufacturer) | No bulk access; prior attempts: Ford Heritage Vault JS-only, Toyota pressroom 403, guessed Ford URLs 404 | Spot-verify only |
| Vehicle Databases (vehicledatabases.com) | Specs / owner's-manual-by-VIN APIs; no tire-placard product listed | Commercial license included | API | Not a fit |
| HaynesPro / Infopro (WorkshopData) | Torque, pressures | Licensable | **Europe-only coverage** | Not a fit for US |
| MOTOR (Hearst) | Repair/spec data; no tire/wheel fitment product surfaced | Licensable | — | Not pursued |
| Tire Guides Inc. / TGP Solutions (publisher of the Tire Guide book + "Lug Nut Torque Chart") | Torque chart, fitment book | Publisher; site cert broken 09-17 | Print/PDF | Same data family as TCS — fold into the TCS conversation |
| wheel-size.com, tirerack, discounttire, simpletire | — | **Banned** | — | Never |

## Recommended actions

1. **Email USAF rep** (draft below): enable `FrontInf`, `RearInf`, `WBC`, `TRQ1` in `GetVehicleOptions` for accounts 1381479 / 1180608; confirm we may surface vehicle-fitment data (sizes, LI, pressure, torque) to our customers and API subscribers.
2. **Load-index pass (ready to run on approval):** USAF pull for every live Y/M/M → `oem_load_index` where our OE size matches exactly one USAF LI (or the trim's size), `oem_load_index_source = 'usaf'`; leave `tireguide-pro` rows untouched unless they disagree (log those). Reversible via `audit_original_data`. Needs a model-alias table for HD trucks / Super Duty / Audi first (the 63 misses above).
3. **Hold torque/pressure bulk work** until (1) or the TCS terms land. Don't scale the counter-print loop.
4. **Public copy**: keep "verified against manufacturer OE specifications"; never name any of the above.

## Draft note to USAF (Scott's framing: retailer need, not a data ask — 2026-09-17 09:50)

> **Subject:** GetVehicleOptions — a few additional vehicle fields for our fitment lookup
>
> Hi ___, quick technical question on the AIS integration. We're using `GetVehicleOptions` on account 1381479 to drive the vehicle lookup on our sites — a customer enters year/make/model, we show the OE tire sizes and load index, they buy the tires (and usually wheels), and the order flows to you through the Order API. That part's working well.
>
> Since we sell wheel and tire packages, the same lookup needs to carry a few more of the basics that show up on every install ticket and product page: factory inflation pressures (front/rear), lug nut torque, and wheel bolt circle.
>
> I noticed the `GetVehicleOptions` response already includes `FrontInf`, `RearInf`, `TRQ1` and `WBC` fields — they just come back empty on our account while `TireSize`, `LoadIndex` and `SpeedRate` populate. Is that something that can be enabled for us? Same for our brick-and-mortar account 1180608 when its API access is set up, since the store counter uses the same specs.
>
> If there's an additional agreement or data tier involved, let me know what's needed and we'll take care of it.
>
> Thanks, Scott — Warehouse Tire

Deliberately omitted: the "may we redistribute via our own fitment API" question. Ask it separately, in writing, before the paid API ships on USAF-derived torque/pressure data.
