# Phase 0 — Parity Test Plan
*Covers P0-10. Defines the Phase 3 acceptance test. Analysis only — no test code yet.*

## Goal
Prove the standalone `@jake/core` engine + **WTD adapter** reproduces the behavior of
the current in-app Jake. If parity holds, we can trust the extraction did not change
Jake's behavior — and only THEN consider (much later, flag-gated) migrating WTD.

## Method
- Fix a script of 10 representative conversations (inputs below).
- Run each against: (A) current live Jake (`/api/jake/chat` or `/stream` on prod/preview), and (B) standalone core + WTD adapter (Phase 3).
- Compare on **behavioral equivalence**, not byte-identical text (LLM output varies).

## Equivalence criteria (per turn)
A turn is "equivalent" if ALL hold:
1. **Same tools called** (same tool names, same key args: year/make/model/size/sku).
2. **Same product SKUs returned** (set equality on top-N results for search turns).
3. **Same fitment facts** (bolt pattern, tire sizes, diameters match).
4. **Same mockup outcome** (success + method `vision-analyzed` + correct body style; image need not be pixel-identical).
5. **Same routing decisions** (e.g. used-tire policy triggers store-phone response; no inventory search).
6. **No regressions** (no error, no empty result where live Jake returned data).

## The 10-conversation fixed script
| # | Scenario | Input | Must-pass checks |
|---|---|---|---|
| 1 | Basic tire size lookup | "what tires fit a 2024 F-150" | lookup_tire_sizes called; correct OEM sizes |
| 2 | Wheel fitment | "bolt pattern for 2020 Silverado 1500" | lookup_wheel_fitment; 6x139.7 |
| 3 | Wheel search w/ finish exclude | "show me wheels for 2021 Ram 1500, no black" | search_wheels w/ excludeFinishes; non-black results |
| 4 | Tire search by size | "275/60R20 tires" | search_tires by size; results w/ prices |
| 5 | Enthusiast platform | "best wheels for 2001 Camaro" | get_platform_context → 4th_gen_fbody; 5x120.65; 20s sweet spot |
| 6 | Staggered performance | "wheels for 2018 Mustang GT" | s550 platform; staggered guidance |
| 7 | Mockup (wheel only) | pick a wheel → "show me on my white F-150" | generate_wheel_mockup; SKU-resolved; vision-analyzed; truck body |
| 8 | Mockup (car body) | "show bronze wheels on a 2020 Camaro" | coupe body (NOT truck); street default tires |
| 9 | Mockup (wheel+tire) | pick wheel + mud tire → mockup | tire SKU resolved; aggressive M/T tread |
| 10 | Used-tire policy | "do you have used tires in 33x12.50R20" | NO inventory search; store-phone response (WTD branding) |

## Notes
- Scenario 10 is **branding-dependent**: under WTD adapter it must return WTD store phones; under demo adapter it returns demo policy text. Parity is checked against WTD branding only.
- Mockup scenarios (7–9) reuse SKUs proven this session: wheel `D68120908250` (Fuel D681 Rebel matte bronze), tire `RBPSTMT320020` (RBP Repulsor M/T 3).
- Run parity against a **preview** deployment of current Jake, never mutate prod.
- Acceptance threshold: **10/10 equivalent** (or documented, justified exceptions Scott approves).
