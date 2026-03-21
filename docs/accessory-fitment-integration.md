# Accessory Fitment Integration

## Overview

This feature automatically calculates and adds required accessories (lug nuts, hub rings) when a customer adds wheels to their cart.

## Files Changed

| File | Changes |
|------|---------|
| `src/hooks/useAccessoryFitment.ts` | Added `calculateAccessoryFitment()` function for async/callback use |
| `src/components/WheelsStyleCard.tsx` | Integrated accessory fitment on Quick Add, accepts `dbProfile` prop |
| `src/components/AddToCartButton.tsx` | Integrated accessory fitment, accepts `dbProfile` + `wheelCenterBore` props |
| `src/app/wheels/page.tsx` | Passes `dbProfile` to `WheelsStyleCard` |
| `src/app/wheels/[sku]/page.tsx` | Passes `dbProfile` + `wheelCenterBore` to `AddToCartButton` |

## Behavior

### When user adds a wheel to cart:

1. **Accessory fitment triggered** - `calculateAccessoryFitment()` computes requirements
2. **Lug nuts evaluation:**
   - If `dbProfile.threadSize` is present → calculates required lug nuts (qty, thread, seat type)
   - Auto-adds to cart when required
   - Logs: `[AddToCartButton] Lug nuts: ADDED - 20 conical lug nuts required (M14x1.5)`
3. **Hub rings evaluation:**
   - If both `dbProfile.centerBoreMm` and wheel `centerBore` are present → compares sizes
   - If wheel bore > vehicle hub → hub rings required
   - Auto-adds to cart when required
   - Logs: `[AddToCartButton] Hub rings: ADDED - Hub rings required: wheel bore 73mm > vehicle hub 71.6mm`
4. **Missing data handling:**
   - Shows warning in console, does NOT guess
   - Logs: `[AddToCartButton] WARNING: Vehicle data missing for accessory fitment`

### Accessory items are tied to wheels

Each accessory item includes `wheelSku` so they can be updated/removed if the wheel selection changes.

---

## Examples

### Example 1: Jeep Wrangler JL (Complete Data)

**Vehicle:** 2023 Jeep Wrangler Rubicon  
**dbProfile:**
```json
{
  "threadSize": "M14x1.5",
  "seatType": "conical",
  "centerBoreMm": 71.6,
  "boltPattern": "5x127"
}
```

**Wheel:** Fuel Vapor D560 20x9 (centerbore: 78.1mm)

**Console Output:**
```
[WheelsStyleCard] Accessory fitment triggered on wheel add: {sku: "D560-2090", hasDbProfile: true, hasVehicle: true}
[calculateAccessoryFitment] Result: {wheel: "D560-2090", hasVehicleData: true, lugNuts: "required", hubRings: "required", requiredCount: 2}
[WheelsStyleCard] Auto-adding required accessories: ["lug_nut: Conical Lug Nut M14x1.5", "hub_ring: Hub Centric Ring 78.1mm → 71.6mm"]
[WheelsStyleCard] Lug nuts: ADDED - 20 conical lug nuts required (M14x1.5)
[WheelsStyleCard] Hub rings: ADDED - Hub rings required: wheel bore 78.1mm > vehicle hub 71.6mm
```

**Cart Result:**
- 4× Fuel Vapor D560 wheels @ $280 = $1,120
- 20× Conical Lug Nut M14x1.5 @ $2.50 = $50.00 ✓ Auto-added
- 4× Hub Centric Ring 78→72mm @ $8.00 = $32.00 ✓ Auto-added

---

### Example 2: Chevy Silverado 1500 (Hub Rings Not Needed)

**Vehicle:** 2022 Chevrolet Silverado 1500 LTZ  
**dbProfile:**
```json
{
  "threadSize": "M14x1.5",
  "seatType": "conical",
  "centerBoreMm": 78.1,
  "boltPattern": "6x139.7"
}
```

**Wheel:** Fuel Blitz D675 20x10 (centerbore: 78.1mm)

**Console Output:**
```
[AddToCartButton] Accessory fitment triggered on wheel add: {sku: "D675-2010", hasDbProfile: true, hasVehicle: true}
[calculateAccessoryFitment] Result: {wheel: "D675-2010", hasVehicleData: true, lugNuts: "required", hubRings: "optional", requiredCount: 1}
[AddToCartButton] Auto-adding required accessories: ["lug_nut: Conical Lug Nut M14x1.5"]
[AddToCartButton] Lug nuts: ADDED - 24 conical lug nuts required (M14x1.5)
[AddToCartButton] Hub rings: SKIPPED - Wheel center bore (78.1mm) matches vehicle hub (78.1mm)
```

**Cart Result:**
- 4× Fuel Blitz D675 wheels @ $320 = $1,280
- 24× Conical Lug Nut M14x1.5 @ $2.50 = $60.00 ✓ Auto-added
- _(No hub rings - bore matches)_

---

### Example 3: Camaro (Missing Vehicle Data)

**Vehicle:** 2019 Chevrolet Camaro SS  
**dbProfile:** `null` (API returned no fitment data)

**Console Output:**
```
[WheelsStyleCard] Accessory fitment triggered on wheel add: {sku: "MR147-M651", hasDbProfile: false, hasVehicle: true}
[WheelsStyleCard] WARNING: Vehicle data missing for accessory fitment {
  vehicle: "2019 Chevrolet Camaro",
  missingFields: {threadSize: true, centerBoreMm: true, seatType: true}
}
[WheelsStyleCard] Skipping accessory fitment - no dbProfile available
```

**Cart Result:**
- 4× Motegi MR147 wheels @ $195 = $780
- ⚠️ No accessories auto-added (data unavailable)
- Customer should verify lug nut requirements separately

---

## Logging Summary

| Log Message | Meaning |
|-------------|---------|
| `Accessory fitment triggered on wheel add` | Fitment calculation started |
| `Lug nuts: ADDED` | Lug nuts were auto-added to cart |
| `Lug nuts: SKIPPED` | Thread size not available |
| `Hub rings: ADDED` | Hub rings were auto-added to cart |
| `Hub rings: SKIPPED` | Bore matches OR data missing |
| `WARNING: Vehicle data missing` | Can't calculate - show warning only |
| `Skipping accessory fitment - no dbProfile` | Profile unavailable |

---

## Future Enhancements

- [ ] UI indicator when accessories are auto-added
- [ ] Cart warning when accessories might be needed but couldn't be determined
- [ ] Real inventory lookup for accessory SKUs (currently placeholder SKUs)
- [ ] Update accessories when wheel selection changes
