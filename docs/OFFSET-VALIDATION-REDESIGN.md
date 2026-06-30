# Wheel Offset Validation Redesign — Implementation Plan

**Status:** PROPOSAL — Not implemented. Awaiting review and approval.  
**Author:** Clawd  
**Date:** 2026-06-30  
**Requested by:** Scott

---

## 1. Root Cause Analysis

There are **four compounding bugs** that together allow wildly inappropriate offsets to be shown as "Recommended."

### Bug 1 — DB Offset Is Stored But Never Used

`vehicle_fitments.offset_min_mm` and `offset_max_mm` are populated (now with real OEM-researched data), but are **never passed into `buildFitmentEnvelope()`**. The function receives only `wheelSpecs` (the `oem_wheel_sizes` JSONB array).

```typescript
// fitment-search/route.ts ~line 1335
const oem: OEMSpecs = {
  boltPattern: dbProfile.boltPattern!,
  centerBore: Number(dbProfile.centerBoreMm || 0) || 0,
  wheelSpecs,   // ← offset_min_mm / offset_max_mm NOT included
};
let envelope = buildFitmentEnvelope(oem, mode);
```

### Bug 2 — Generic Fallback When Wheel Offsets Are Missing

`oem_wheel_sizes` entries rarely include an `offset` field. When none are present:

```typescript
// aftermarketFitment.ts ~line 354
const offsets = oem.wheelSpecs.map(s => s.offset).filter((o): o is number => o !== null);
const oemMinOffset = offsets.length > 0 ? Math.min(...offsets) : 20;  // ← generic fallback
const oemMaxOffset = offsets.length > 0 ? Math.max(...offsets) : 50;  // ← generic fallback
```

Grand Marquis OEM offset is +11mm. The system falls back to 20–50mm — a 39mm error on the minimum alone.

### Bug 3 — Expansion Presets Add Even More Width

The fallback OEM range (20–50mm) is then expanded further by the mode preset:

| Mode | offsetExpandLow | offsetExpandHigh |
|------|----------------|-----------------|
| aftermarket_safe | 25mm | 15mm |
| aggressive | 70mm | 25mm |
| truck | 120mm | 35mm |

Grand Marquis in `aftermarket_safe` mode:
- `oemMaxOffset` = 50mm (wrong fallback)
- `allowedMaxOffset` = 50 + 15 = **65mm**
- +40mm wheel: `40 ≤ 65` → passes, labeled "Popular Upgrade"
- Actual delta from real OEM (+11mm): **+29mm inboard shift** — suspension clearance risk

### Bug 4 — No Geometric Model

The system treats offset as a single-dimension range check with no physical geometry behind it. It doesn't account for:

- The fact that changing wheel WIDTH moves the wheel's contact patch even when offset is constant
- That going MORE positive (tucked) is mechanically dangerous but going MORE negative (poke) is mostly aesthetic
- That `(offset, width)` together determine the actual wheel position relative to suspension components — not offset alone

---

## 2. Proposed Algorithm

### Core Concept: OEM-Relative Position Deltas

Instead of checking "is this offset within range X–Y?", calculate the **physical position change** the candidate wheel causes compared to OEM:

```
For any wheel (width_in, offset_mm) vs OEM (oem_width_in, oem_offset_mm):

backspacing = offset_mm + (width_in × 25.4 / 2)

delta_backspacing = candidate_backspacing - oem_backspacing
                  = (candidate_offset - oem_offset) + (candidate_width - oem_width) × 12.7

delta_outboard    = (candidate_width - oem_width) × 12.7 - (candidate_offset - oem_offset)

delta_track_width = -delta_backspacing × 2   (both sides combined)
```

**Physical meaning:**
- `delta_backspacing > 0` → wheel moved INWARD (toward strut/caliper/inner fender) — **dangerous direction**
- `delta_backspacing < 0` → wheel moved OUTWARD (toward fender lip) — **aesthetic risk only**
- `delta_outboard > 0` → wheel face pokes further out — visible stance change
- `delta_outboard < 0` → wheel face is more tucked — common with plus-sizing

**Grand Marquis example:**
- OEM: 16×7, ET+11 → backspacing = 11 + (7×12.7) = 11 + 88.9 = 99.9mm
- Candidate: 17×8, ET+40 → backspacing = 40 + (8×12.7) = 40 + 101.6 = 141.6mm
- `delta_backspacing` = 141.6 − 99.9 = **+41.7mm inboard** → exceeds ALL profiles → EXCLUDED

### Profile Thresholds

Three profiles replace the current four fitment modes:

#### Profile 1: Conservative (replaces "oem")
_Exact replacement / daily commuter. No visible stance change._

| Measurement | Max inboard | Max outboard |
|------------|------------|-------------|
| delta_backspacing | +8mm | −10mm |
| delta_outboard | +8mm | −8mm |

Cars stay within ~⅓" of OEM wheel position in any direction.

#### Profile 2: Daily Driver (replaces "aftermarket_safe")
_Standard aftermarket fitment. Safe clearances, mild stance improvement acceptable._

| Vehicle Class | Max inboard (delta_bs) | Max outboard (delta_out) |
|--------------|----------------------|------------------------|
| Passenger car | +12mm | +18mm |
| SUV/Crossover | +15mm | +25mm |
| Truck (6-lug) | +18mm | +35mm |
| HD Truck (8-lug) | +12mm | +35mm |

#### Profile 3: Aggressive (replaces "aggressive" + "truck")
_Enthusiast build. Requires awareness of potential modifications needed._

| Vehicle Class | Max inboard (delta_bs) | Max outboard (delta_out) |
|--------------|----------------------|------------------------|
| Passenger car | +18mm | +35mm |
| SUV/Crossover | +22mm | +50mm |
| Truck (6-lug) | +25mm | +80mm |
| HD Truck/Lifted | +20mm | +120mm |

**Absolute safety ceiling (all profiles):**
- delta_backspacing > +30mm → **always excluded** (risk of caliper/strut contact on any vehicle)
- delta_backspacing < −60mm → **always excluded** (structural bearing load)

### OEM Offset Source (Single Value)

The system needs a **single OEM offset** to compute deltas. Priority:

1. **`oem_wheel_sizes` JSONB offset field** (when present and non-null)
2. **Midpoint of `(offset_min_mm + offset_max_mm) / 2`** from the vehicle_fitments row
3. **Fallback**: 35mm for FWD cars, 25mm for RWD cars, 15mm for trucks/SUVs

For the Grand Marquis: `(0 + 44) / 2 = 22mm` as proxy — still better than the current 20–50mm fallback.

> **Recommendation:** Add an `oem_offset_mm` column to `vehicle_fitments` in a future migration. For now, use the midpoint.

### Updated Classification Logic

```
For each candidate wheel:

1. Compute delta_backspacing and delta_outboard
2. Check absolute safety ceiling → if exceeded: EXCLUDED (hard rule)
3. Check current profile thresholds:
   - Within threshold → SUREFIT or SPECFIT (existing diameter/width logic)
   - Exceeds current profile but within aggressive threshold → EXTENDED
   - Exceeds aggressive threshold → EXCLUDED
4. Bolt pattern and center bore remain hard rules (unchanged)
```

Offset is no longer a soft-only rule — geometric violations become hard exclusions.

### Ranking Improvement

After validation, sort by **geometric closeness to OEM** as a secondary rank signal:

```
geometricScore = 100 - (|delta_backspacing| × 2.5 + |delta_outboard| × 1.0)
               clamped to [0, 100]
```

This replaces the current "is offset within OEM range" boolean bonus with a continuous score. Wheels closer to OEM position rank higher naturally.

---

## 3. Files Requiring Modification

### Modified Files

#### `src/lib/aftermarketFitment.ts`
- Add `GeometryResult` type: `{ delta_backspacing, delta_outboard, delta_track_width, profile, inboardExceeded, outboardExceeded, safetyExceeded }`
- Add `computeWheelGeometry(candidate, oemOffset, oemWidth)` pure function
- Add `GEOMETRY_THRESHOLDS` constant replacing `EXPANSION_PRESETS` for offset logic (diameter/width presets stay)
- Update `validateWheel()` to accept optional `oemGeometry` param; compute geometry check if provided; promote geometry violations to hard exclusions
- Keep `FitmentMode` type and `EXPANSION_PRESETS` for diameter/width (those rules are fine)
- Add `geometricScore` field to `FitmentValidation` return type

#### `src/app/api/wheels/fitment-search/route.ts`
- Extract OEM offset from `dbProfile`: `oemOffset = oem_wheel_sizes[0]?.offset ?? midpoint(offsetMinMm, offsetMaxMm) ?? classFallback`
- Extract OEM width from `dbProfile`: `oemWidth = oem_wheel_sizes[0]?.width ?? null`
- Pass `oemOffset` and `oemWidth` into `validateWheel()` call so geometry can be computed
- Staggered vehicles: pass front OEM offset/width for front axle validation, rear for rear axle
- Map existing mode params to new profiles for backward compat (`aftermarket_safe` → `daily_driver`)
- Update ranking section to incorporate `geometricScore`

### New Files

#### `src/app/api/admin/fitment-audit/route.ts`
Admin endpoint that queries the database and runs geometry checks across all vehicles. Reports:
- Vehicles where `avg_recommended_offset` differs from OEM by >20mm
- Vehicles where any shown wheel has `delta_backspacing > 25mm`
- Vehicles where inner clearance would go negative given typical strut-to-hub distance
- Top 50 worst-offending vehicles

#### `src/app/admin/fitment-audit/page.tsx`
Simple admin UI displaying the audit report table with sortable columns.

---

## 4. Safety Impact

**Positive safety effects:**
- Eliminates wheels where the back face would contact the strut tower, caliper, or brake line
- Eliminates wheels where extreme positive offset increases wheel bearing load beyond design spec
- Keeps suspension geometry (scrub radius, caster trail) closer to OEM intent

**Risk of the current system:**
- A customer buys a wheel shown as "Popular Upgrade" for their Grand Marquis
- Wheel physically bolts on (bolt pattern and center bore pass)
- Back of wheel contacts strut or caliper bracket at full lock
- Contact causes metal-to-metal wear, vibration, potential brake failure

**No regression on legitimate aftermarket:**
- Mild plus-sizing (e.g., 16x7 ET11 → 17x8 ET15) → delta_backspacing = +4 + 12.7 = 16.7mm → passes daily driver
- Standard truck wheel (e.g., Silverado OEM 18x8.5 ET24 → aftermarket 20x9 ET18) → delta_backspacing = -6 + 8 = 2mm → passes all profiles
- Wide aggressive wheel (e.g., F-150 20x9 ET0) → delta_backspacing = (0-24) + 8 = -16mm (outboard movement) → passes all profiles

---

## 5. Effect on Existing Vehicle Coverage

**Grand Marquis (OEM 16x7 ET+11):**
- Current: shows ~6,066 wheels including ET+40, ET+45, ET+50
- After: shows wheels where delta_backspacing ≤ +12mm
  - ET+11, same width: delta = 0 → all pass ✓
  - ET+18, 7" wide: delta = +7 → pass ✓
  - ET+23, 8" wide: delta = (12 + 12.7) = 24.7 → extended only ✓
  - ET+40, 8" wide: delta = 41.7 → EXCLUDED ✓
- Estimated reduction: 20–30% of current results removed for this vehicle class

**F-150 (OEM 18x8 ET24, 6-lug):**
- Truck profile is more permissive on outboard, restrictive on inboard
- ET0, 9" wide: delta_bs = (0-24) + 8 = -16mm (outboard) → passes ✓
- ET-12, 9" wide: delta_bs = (-12-24) + 8 = -28mm (outboard) → passes ✓
- ET44, 9" wide: delta_bs = (44-24) + 8 = 28mm → just exceeds daily driver (18mm) → extended
- Minimal coverage loss for trucks since negative offset (popular for trucks) is the safe direction

**BMW M4 (staggered, front ET35/rear ET22):**
- Front: validated against ET35, rear against ET22 independently
- Rear ET20, 10.5" wide: delta_bs vs rear OEM (9" wide, ET22) = (20-22) + (10.5-9)×12.7 = -2 + 19 = +17mm → within aggressive ✓
- No impact on staggered support

**Overall estimated coverage impact:** 15–25% reduction in total wheels shown for passenger cars. Trucks/SUVs: 5–10% reduction. Staggered vehicles: negligible.

---

## 6. Effect on Staggered Vehicles

Staggered fitment support is **fully preserved**. The geometry calculation is already per-axle — it only needs the OEM offset and width for that axle.

Implementation detail:
```typescript
// Front axle geometry
if (staggeredInfo.frontSpec) {
  const frontOemOffset = staggeredInfo.frontSpec.offset ?? oemOffset;
  const frontOemWidth  = staggeredInfo.frontSpec.width  ?? oemWidth;
  // validate front wheels against frontOemOffset + frontOemWidth
}

// Rear axle geometry — independently
if (staggeredInfo.rearSpec) {
  const rearOemOffset = staggeredInfo.rearSpec.offset ?? oemOffset;
  const rearOemWidth  = staggeredInfo.rearSpec.width  ?? oemWidth;
  // validate rear wheels against rearOemOffset + rearOemWidth
}
```

For Corvette C8 (front 9"×ET57 / rear 11.5"×ET57):
- Front candidate 9.5"×ET55: delta_bs = (55-57) + (9.5-9)×12.7 = -2 + 6.35 = +4.35mm → surefit ✓
- Rear candidate 12"×ET52: delta_bs = (52-57) + (12-11.5)×12.7 = -5 + 6.35 = +1.35mm → surefit ✓
- Rear candidate 12"×ET35: delta_bs = (35-57) + 6.35 = -15.65mm (outboard) → passes, wider stance ✓

BMW M3/M4, Mustang Performance Pack, Camaro SS 1LE: identical treatment — each axle validated independently against its own OEM spec.

---

## 7. Validation Plan

### Phase 1 — Unit Test `computeWheelGeometry`

| Scenario | Inputs | Expected delta_bs | Expected result |
|----------|--------|------------------|----------------|
| Exact OEM match | candidate = oem | 0mm | surefit |
| Same size, +5mm offset | +5mm offset, same width | +5mm | surefit (daily driver) |
| Same size, +15mm offset | +15mm offset, same width | +15mm | specfit (daily driver), excluded (conservative) |
| Same size, +35mm offset | +35mm offset, same width | +35mm | excluded (all profiles) |
| Plus-1" width, same offset | +1" width, same offset | +12.7mm | specfit (daily driver) |
| Plus-1" width, +5mm offset | +5mm offset, +1" width | +17.7mm | extended (daily driver) |
| Negative offset (truck) | OEM ET24, candidate ET0, 9" vs 8" | -16mm (outboard) | passes all |
| Extreme negative (lifted) | OEM ET24, candidate ET-25, 9" vs 8" | -41mm outboard | aggressive only |

### Phase 2 — Integration Test Against Known Vehicles

Test `fitment-search` for these vehicles and verify the result set:

| Vehicle | OEM Offset | Expected max candidate offset (daily driver) | Problem wheels to confirm excluded |
|---------|-----------|---------------------------------------------|-----------------------------------|
| 2000 Mercury Grand Marquis | ET+11 | ET+23 (7" wide) | ET+40+ |
| 2015 Toyota Camry | ET+45 | ET+57 (7.5" wide) | ET+65+ |
| 2020 F-150 (6-lug) | ET+44 | ET+62 (9.5" wide) or ET+20 | — |
| 2018 Silverado (6-lug) | ET+24 | ET+42 (9" wide) | ET+55+ |
| 2020 BMW M4 (staggered) | Front ET+35 / Rear ET+22 | Front ET+47 / Rear ET+34 | Rear ET+50+ |
| 2019 Corvette C7 (staggered) | Front ET+57 / Rear ET+57 | ±12mm | ET+80+ excluded |
| 2018 Jeep Wrangler JK | ET-12.7 | ET+5 or ET-45 | ET+20+ |

### Phase 3 — Regression Test (no staggered breakage)

Run the staggered fitment QA scripts on:
- Corvette C7, C8
- BMW M3, M4, M5
- Mustang GT Performance Pack
- Camaro SS 1LE
- Porsche 911 (991)

Confirm front/rear wheel pairs still returned correctly.

### Phase 4 — Admin Audit Tool

Run the new audit endpoint against production DB. Expected findings:
- ~0 vehicles with delta_backspacing > 30mm in daily driver results (post-fix)
- Any remaining outliers flagged for manual review

---

## 8. Test Plan

### Automated Tests (new file: `src/lib/__tests__/geometryValidator.test.ts`)

```typescript
describe("computeWheelGeometry", () => {
  it("exact OEM returns zero deltas")
  it("higher offset increases delta_backspacing proportionally")
  it("wider wheel increases delta_backspacing by width_delta × 12.7")
  it("narrower wheel with lower offset can be neutral")
  it("negative offset moves wheel outboard")
  it("safety ceiling rejects delta_backspacing > 30mm")
})

describe("validateWheel with geometry", () => {
  it("Grand Marquis: ET+40 excluded in daily driver")
  it("Grand Marquis: ET+18 passes daily driver")
  it("F-150: ET-25 passes aggressive")
  it("F-150: ET+50 excluded (too positive for truck)")
  it("staggered front validates independently from rear")
})
```

### Manual QA Checklist

- [ ] Search 2000 Mercury Grand Marquis → no ET+30 or higher on page 1
- [ ] Search 2020 F-150 → ET-12 wheels present in results
- [ ] Search 2019 Corvette → staggered pairs show correctly
- [ ] Search 2018 BMW M4 → staggered, rear 10.5" wheels included
- [ ] Search 2016 Mustang GT Performance Pack → staggered works
- [ ] Brand filter still shows all 129 brands
- [ ] Diameter facet shows no duplicates
- [ ] Debug mode (`?debug=true`) shows `geometryResult` per wheel

---

## 9. Expected Before/After Examples

### Example 1: 2000 Mercury Grand Marquis (OEM: 16×7, ET+11)

**Before:**
| Wheel | fitmentClass | Guidance |
|-------|-------------|---------|
| 17×8 ET+40 | specfit | "Popular Upgrade" |
| 18×9 ET+35 | specfit | "Popular Upgrade" |
| 20×9 ET+35 | extended | "Popular Upgrade" |

**After:**
| Wheel | delta_bs | fitmentClass | Guidance |
|-------|----------|-------------|---------|
| 16×7 ET+11 | 0mm | surefit | "Perfect Fit" |
| 17×7 ET+15 | +4mm | surefit | "Perfect Fit" |
| 17×8 ET+18 | +19.7mm | extended | "Aggressive — verify clearance" |
| 17×8 ET+40 | +41.7mm | **excluded** | — (hidden) |
| 18×9 ET+35 | +48.7mm | **excluded** | — (hidden) |

---

### Example 2: 2020 Ford F-150 (OEM: 18×8, ET+44, 6-lug)

**Before:** Shows ET+0 through ET+60, all labeled similarly.

**After:**
| Wheel | delta_bs | fitmentClass | Guidance |
|-------|----------|-------------|---------|
| 20×9 ET+24 | -8mm (outboard) | surefit | "Perfect Fit" |
| 20×9 ET+0 | -32mm (outboard) | specfit | "Aggressive Stance" |
| 20×9 ET-12 | -44mm (outboard) | extended | "Requires fender inspection" |
| 20×9 ET+58 | +22mm | extended | "Tucked — verify strut clearance" |
| 20×9 ET+68 | +32mm | **excluded** | — |

---

### Example 3: 2019 Corvette C7 (staggered: Front 8.5"×ET57 / Rear 10"×ET57)

**Before and After:** No change — staggered already handled correctly. Geometry validates each axle independently.

| Wheel | Axle | delta_bs | Class |
|-------|------|----------|-------|
| 9.5"×ET52 | Front | (52-57)+(9.5-8.5)×12.7 = -5+12.7 = +7.7mm | surefit ✓ |
| 11"×ET55 | Rear | (55-57)+(11-10)×12.7 = -2+12.7 = +10.7mm | surefit ✓ |
| 12"×ET25 | Rear | (25-57)+(12-10)×12.7 = -32+25.4 = -6.6mm | specfit ✓ |

---

### Example 4: 2018 Jeep Wrangler JK (OEM: 17×7.5, ET-12.7)

**Before:** Shows ET+35 wheels that technically bolt on but look ridiculous and can cause inner fender contact.

**After:**
| Wheel | delta_bs | Class | Guidance |
|-------|----------|-------|---------|
| 17×8 ET-12 | (-12+12.7)+(0.5×12.7) = 7.1mm | surefit | "Perfect Fit" |
| 17×9 ET-25 | (-25+12.7)+(1.5×12.7) = 6.7mm | surefit | "Perfect Fit" |
| 20×9 ET-18 | (-18+12.7)+(1.5×12.7) = 13.8mm | specfit | "Recommended" |
| 17×7.5 ET+25 | 25+12.7+0 = 37.7mm | **excluded** | — |

---

### Example 5: 2015 Toyota Camry (OEM: 17×7, ET+45)

**Before:** Shows ET+60, ET+55 as normal results.

**After:**
| Wheel | delta_bs | Class | Guidance |
|-------|----------|-------|---------|
| 18×7.5 ET+45 | 0+(0.5×12.7) = +6.35mm | surefit | "Perfect Fit" |
| 18×8 ET+45 | 0+(1×12.7) = +12.7mm | specfit | "Recommended" |
| 19×8.5 ET+38 | -7+(1.5×12.7) = +12.05mm | specfit | "Recommended" |
| 18×8 ET+58 | +13+12.7 = +25.7mm | extended | "Verify strut clearance" |
| 18×8 ET+65 | +20+12.7 = +32.7mm | **excluded** | — |

---

## Implementation Sequence

If approved, suggested order:

1. Add `computeWheelGeometry()` to `aftermarketFitment.ts` (pure function, no side effects)
2. Add unit tests
3. Wire OEM offset extraction into `fitment-search` route (without changing validation yet — add to debug output)
4. Run audit against production to confirm expected behavior
5. Enable geometry checks in validation (soft classification first, then hard exclusions)
6. Adjust `GEOMETRY_THRESHOLDS` based on audit results
7. Add admin audit endpoint + UI
8. QA pass across all test vehicles
9. Deploy

**Estimated scope:** ~500 lines new/modified code, 2–3 days of implementation and testing.
