# Fitment API — Plus-Size / Aftermarket Fitment (v1 spec)

**Status:** Approved direction (Scott, 2026-09-14). Not started. Ship after Shopify app is hosted + listed.
**Owner:** Clawd
**Estimate:** 3–4 working days to production, trucks/SUVs first.

---

## 1. Why this is the product

OEM fitment (bolt pattern, center bore, factory sizes) is commodity data. Every competitor has it; wheel sites already know it.

What a **wheel site** cannot answer — and what tanks their conversion — is:

> "Will *this* 20×10 −18 fit *my* 2021 Silverado, and what do I need to do to run it?"

Nobody sells a cheap, honest answer to that. We already compute it for every wheel on our own store (`src/lib/fitment/guidance.ts`, live since 2026-04-07, calibrated on real customers). Exposing it turns the API from "a fitment database" into **"the fitment brain for any wheel store."** That's the selling point, and it's why a Shopify/Woo wheel shop would pay Growth/Scale rather than Starter.

Positioning line: *"OEM fitment tells you what came on the truck. We tell you what fits."*

---

## 2. What we already have (reuse, don't rebuild)

| Capability | Where | Status |
|---|---|---|
| OEM baseline per trim (bolt, bore, wheel dia/width/offset, tire sizes, staggered, vehicle type) | `universalFitmentResolver.ts`, `public-fitment-service.ts` | ✅ prod, API-exposed |
| Poke calculation + build requirement (stock / level / lift-small / lift-large / may-trim) | `fitment/guidance.ts` → `calculateFitmentGuidance()` | ✅ prod (site badges) |
| Fitment level (perfect / recommended / popular / aggressive) | same | ✅ prod |
| Width multipliers (10"=1.1, 12"=1.25, 14"=1.4) + diameter bonus | same | ✅ prod |
| Tire size parse + overall diameter + variance | `classic-fitment/classicTireUpsize.ts` | ✅ prod |
| Inboard safety ceiling (strut/brake clearance, 30 mm) | `fitment/geometryValidator.ts` | ✅ prod |
| Staggered handling | `fitment/staggeredFitment.ts` | ✅ prod |
| Fitment class (surefit / specfit / extended) | `fitment/buildTypeFilter.ts` | ✅ prod |
| Vehicle class (car / suv / truck) on records | fitment DB `vehicle_type` | ✅ (coverage to verify — §7) |

**Net new code:** two thin API routes, a response shaper, a "candidate size matrix," docs, and tests. The math is done.

---

## 3. Endpoints

### 3.1 `GET /api/public/fitment/check` — "Will this fit?"

The product-page endpoint. Merchant already has a wheel (and maybe a tire) and a customer's vehicle.

**Request**

```
GET /api/public/fitment/check
  ?year=2021&make=Chevrolet&model=Silverado%201500&trim=<trimId>
  &diameter=20&width=10&offset=-18
  [&boltPattern=6x139.7]          # optional: we verify it matches
  [&tire=285/55R20]               # optional: adds tire diameter check
  [&rearDiameter=..&rearWidth=..&rearOffset=..&rearTire=..]  # staggered
  [&profile=daily_driver]         # conservative | daily_driver (default) | aggressive
X-API-Key: wtd_...
```

**Response**

```json
{
  "success": true,
  "data": {
    "vehicle": { "year": 2021, "make": "Chevrolet", "model": "Silverado 1500", "trim": "LT Trail Boss", "vehicleType": "truck" },
    "wheel":   { "diameter": 20, "width": 10, "offset": -18 },
    "tire":    { "size": "285/55R20", "overallDiameterIn": 32.3 },

    "fits": true,
    "verdict": "level",
    "verdictLabel": "Requires leveling kit (1–2\")",
    "level": "popular",
    "levelLabel": "Popular upgrade",

    "boltPatternMatch": true,
    "centerBoreOk": true,

    "geometry": {
      "pokeMm": 62.4,
      "pokeIn": 2.46,
      "widthDeltaIn": 2.0,
      "offsetDeltaMm": 36,
      "diameterDeltaIn": 0,
      "inboardDeltaMm": -12.6,
      "inboardSafe": true,
      "tireDiameterDeltaIn": 0.6,
      "tireDiameterDeltaPct": 1.9
    },

    "notes": [
      "Wheel sits 62 mm (2.5\") further out than OEM — leveling kit recommended to avoid rubbing at full lock.",
      "Tire is 1.9% taller than OEM — within 3% safe range; no speedometer recalibration needed."
    ],
    "warnings": [],
    "confidence": "high",
    "disclaimer": "Fitment guidance is calculated from OEM specifications and typical clearances. Verify before purchase; suspension wear, aftermarket parts, and tire brand variance affect real-world fit."
  }
}
```

**`verdict` enum** (maps 1:1 to `BuildRequirement`): `stock` | `level` | `lift-small` | `lift-large` | `may-trim` | `no-fit`

**`fits: false` + `verdict: "no-fit"`** when: bolt pattern mismatch, center bore too small (wheel bore < hub), inboard ceiling exceeded (`inboardDeltaMm > 30` → strut/brake contact), or tire diameter > +15% / < −10% of OEM.

**`confidence`:** `high` (OEM offset + width known, vehicle type known) · `medium` (offset estimated from range, or vehicle type inferred) · `low` (car/unknown class — see §5).

**Errors** follow existing shape `{success:false, error:{code,message}}`: `VEHICLE_NOT_FOUND`, `TRIM_REQUIRED` (model has >1 trim and none given), `INVALID_WHEEL` (bad/missing dims), `INVALID_TIRE`.

### 3.2 `GET /api/public/fitment/plus-sizes` — "What fits?"

The browse endpoint. Merchant has a vehicle and wants to show the customer a grid of sizes that work, or filter their catalog.

**Request**

```
GET /api/public/fitment/plus-sizes
  ?year=2021&make=Chevrolet&model=Silverado%201500&trim=<trimId>
  [&maxBuild=level]        # stock | level | lift-small | lift-large (default: lift-large = show all)
  [&diameters=20,22]       # restrict
  [&profile=daily_driver]
```

**Response**

```json
{
  "success": true,
  "data": {
    "vehicle": { ... },
    "oem": { "diameter": 20, "width": 8, "offset": 18, "boltPattern": "6x139.7", "centerBore": 78.1, "tireSizes": ["275/60R20"] },
    "sizes": [
      { "diameter": 20, "width": 9,  "offsetRange": [0, 25],    "verdict": "stock",      "level": "recommended", "tires": ["275/60R20","285/55R20"] },
      { "diameter": 20, "width": 10, "offsetRange": [-18, -12], "verdict": "level",      "level": "popular",     "tires": ["285/55R20","305/55R20"] },
      { "diameter": 20, "width": 12, "offsetRange": [-44, -44], "verdict": "lift-small", "level": "aggressive",  "tires": ["33x12.50R20"] },
      { "diameter": 22, "width": 10, "offsetRange": [-18, -18], "verdict": "level",      "level": "popular",     "tires": ["285/45R22","305/45R22"] },
      { "diameter": 22, "width": 12, "offsetRange": [-44, -44], "verdict": "lift-large", "level": "aggressive",  "tires": ["33x12.50R22","35x12.50R22"] }
    ],
    "confidence": "high",
    "disclaimer": "..."
  }
}
```

**Candidate matrix (v1, trucks/SUVs):** for each diameter in `{OEM, +1, +2, +3, +4}` (cap 24") × width `{OEM, +1, +2, +3, +4}` (cap 14") × the *common aftermarket offsets* for that width (`9"→[+18,+0]`, `10"→[-18,-12,-24]`, `12"→[-44,-51]`, `14"→[-76]`; table in code, editable) → run `calculateFitmentGuidance` → keep those ≤ `maxBuild` → collapse identical verdicts into `offsetRange`. Tire suggestions come from `classicTireUpsize.getClassicTireSizesForWheelDiameter()` filtered to ±3% (stock/level) or ±8% (lift) of OEM overall diameter.

This is deterministic and cheap (~50 combos, pure math, no DB beyond the OEM lookup) — cache 24 h per trim.

### 3.3 Enrich existing `/specs` (small)

Add to `PublicFitmentSpecs`:

```json
"vehicleType": "truck",
"oemOffsetTypical": 18,
"plusSizeSupported": true
```

So a client knows up front whether `/check` and `/plus-sizes` will return `high` confidence for this vehicle.

---

## 4. Response contract rules

- Always include `disclaimer` on `/check` and `/plus-sizes`. Docs require merchants to display it or equivalent.
- Never return `fits: true` with `confidence: "low"` — downgrade to `fits: null, verdict: "unknown"` with a note. Honest beats confident-wrong; a wrong "fits" costs the merchant a return and us a customer.
- `notes[]` are customer-safe plain English (merchants will render them verbatim). `warnings[]` are for the merchant/dev.
- All millimetre values also in inches — US market.

---

## 5. Scope: trucks/SUVs first, cars honest

The guidance engine's thresholds were calibrated on trucks/SUVs (Silverado, F-150, Ram, Tacoma, Wrangler, Bronco, 4Runner…). For **cars**, poke isn't the dominant constraint — fender lip, camber, fender-liner contact and strut clearance are — and our thresholds haven't been validated there.

**v1 policy:**
- `vehicleType ∈ {truck, suv}` → full `/check` + `/plus-sizes`, `confidence: high|medium`.
- `vehicleType = car` → `/check` returns bolt/bore/inboard checks + tire diameter variance (those are geometry, universally valid) but `verdict: "unknown"` for build requirement, `confidence: "low"`, note: *"Aftermarket build guidance for passenger cars is coming; OEM-equivalent and +1 sizes with OEM-range offsets are generally safe."* `/plus-sizes` returns only `{OEM, +1}` diameter with OEM width ±1 and OEM offset ±5 → `verdict: "stock"`.
- Cars v2 (later): separate car thresholds using fender-clearance model; validate against Mustang/Camaro/Challenger (already Tier-A trim data) and common sedans.

Being explicit about this in the docs is a feature: it's the opposite of the "everything fits" garbage the market is used to.

---

## 6. Pricing / packaging

- `/check` and `/plus-sizes` are **Growth ($249) and Scale ($499) only**. Starter stays OEM-only. This gives the upgrade path a reason to exist.
- Count `/plus-sizes` as **3 calls** against quota (it does ~50 internal calcs, and it's the valuable one). `/check` = 1 call.
- Landing page: new section "Beyond OEM — graded aftermarket fitment" with a live `/check` demo (extend `LiveDemo.tsx`: after specs, show a "Try a plus-size" row: diameter/width/offset inputs → verdict badge).
- Shopify app / Woo plugin: v1.1 adds a **"Will it fit?"** product-page block: reads the shopper's saved vehicle (`localStorage wtd:fitment`) + wheel dims from product metafields → calls `/check` → renders verdict badge. That's the feature that makes a wheel store install the app.

---

## 7. Data readiness checks (do first, ~2 h)

1. **`vehicle_type` coverage** — query fitment DB: % of 2000+ records with `vehicle_type` set and ∈ {car, suv, truck}. Anything null → infer from model name map (F-150/Silverado/Ram/Tundra/Tacoma/… = truck; Tahoe/4Runner/Explorer/… = suv) and backfill.
2. **OEM offset coverage** — `/check` needs a typical OEM offset. `guidance.ts` already has `getOemTypicalOffset()` fallback by vehicle type; measure how often we fall back (→ `confidence: medium`).
3. **OEM width coverage** — same.
4. **Staggered trims** — ensure `/check` uses front baseline for front wheel input and rear for rear.

Output: a short readiness report with coverage %, so the docs can say "high-confidence guidance for N vehicles."

---

## 8. Implementation plan

| Day | Work |
|---|---|
| **0.5** | §7 readiness queries + backfill script for `vehicle_type` |
| **1** | `src/lib/api/public-fitment-check.ts`: adapter from `PublicFitmentSpecs` → `OEMBaseline`; wrap `calculateFitmentGuidance` + `geometryValidator` + tire variance → `CheckResult`. Unit tests using the calibration table in `guidance.ts` comments (20×9+18 stock · 20×10−18 level · 20×12−44 lift-small · 22×12−44 lift-large) as golden cases. |
| **1** | `/api/public/fitment/check` route (via `withPublicApi`, plan gate Growth+). `/specs` enrichment. |
| **1** | `src/lib/api/plus-size-matrix.ts` + `/api/public/fitment/plus-sizes` route, 24 h cache, 3-call quota weight. |
| **0.5** | Docs: `/fitment-api` endpoints section + `docs/fitment-api/API.md`; disclaimer language; LiveDemo "Try a plus-size" row. |
| **0.5** | Smoke against 20 real vehicles vs. what our own site shows (parity check — the site badge and the API verdict must agree). |
| *(later)* | Shopify/Woo "Will it fit?" block v1.1. Car thresholds v2. |

**Plan gate:** `withPublicApi` already resolves the key's plan; add `requirePlan(["growth","scale"])` helper returning `PLAN_REQUIRED` error with upgrade link.

---

## 9. Risks & honest notes

- **Liability.** We're telling strangers' customers what fits. Mitigations: mandatory disclaimer in every response, `confidence` field, conservative defaults (`daily_driver` profile), no `fits:true` on low confidence, and ToS clause (already have `/fitment-api/terms` — add "guidance is advisory"). Same posture as our own site, which has run this for months.
- **Calibration drift.** Thresholds are one engine for all trucks. A Tacoma and a Ram 3500 aren't the same. v1 accepts this (it's what the site does today); v1.5 could add per-platform overrides table. Log every `/check` (vehicle + wheel + verdict) so we can find disagreements.
- **Competitive copy.** Once public, the verdict logic is inferable from outputs. Fine — the moat is the OEM dataset + calibration + being first with a plug-in for it, not the formula.
- **Don't let this delay the Shopify listing.** Hosting + listing is blocking revenue today; this is the *second* thing.

---

## 10. One-line summary for the landing page

> **Beyond OEM.** Send us a vehicle and a wheel. We tell you if it fits, and whether it needs a level, a lift, or nothing at all — the same engine that runs our own store.
