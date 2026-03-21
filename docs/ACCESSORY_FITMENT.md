# Accessory Auto-Fitment Design

## Overview

Auto-select matching accessories (lug nuts, hub rings) based on `dbProfile` data from the DB-first fitment system.

## Data Sources

### From `dbProfile` (vehicle-specific)
```typescript
interface DBFitmentProfile {
  // Lug nut matching
  threadSize: string | null;    // e.g., "M14x1.5", "M12x1.25", "M12x1.5"
  seatType: string | null;      // e.g., "conical", "ball", "flat", "mag"
  
  // Hub ring matching  
  centerBoreMm: number | null;  // e.g., 71.5, 78.1, 106.1
  
  // Additional context
  boltPattern: string | null;   // e.g., "5x127", "6x139.7"
}
```

### From Selected Wheel
```typescript
interface WheelSpec {
  centerBore: number;     // Wheel's center bore (usually larger than vehicle's)
  boltPattern: string;    // Must match vehicle
  seatType?: string;      // Some wheels specify required seat type
}
```

---

## Lug Nut Matching

### Required Fields
| Field | Source | Example |
|-------|--------|---------|
| Thread Size | `dbProfile.threadSize` | M14x1.5 |
| Seat Type | `dbProfile.seatType` OR wheel spec | conical |
| Quantity | 4 or 5 lugs × 4 wheels | 20 |

### Matching Logic
```typescript
function matchLugNuts(dbProfile: DBFitmentProfile, wheel?: WheelSpec): LugNutMatch[] {
  // 1. Parse thread size
  const thread = parseThreadSize(dbProfile.threadSize);
  // { diameter: 14, pitch: 1.5 }
  
  // 2. Determine seat type (wheel spec overrides vehicle default)
  const seat = wheel?.seatType || dbProfile.seatType || 'conical';
  
  // 3. Calculate quantity from bolt pattern
  const lugsPerWheel = parseInt(dbProfile.boltPattern?.split('x')[0] || '5');
  const totalQty = lugsPerWheel * 4;
  
  // 4. Query inventory
  return queryLugNuts({
    threadDiameter: thread.diameter,
    threadPitch: thread.pitch,
    seatType: seat,
    minQty: totalQty,
  });
}
```

### Common Thread Sizes
| Thread | Common Vehicles |
|--------|-----------------|
| M12x1.25 | Nissan, Subaru, older imports |
| M12x1.5 | Honda, Toyota, Mazda, Hyundai/Kia |
| M14x1.5 | Ford, GM, Chrysler, BMW, VW/Audi |
| M14x2.0 | Some Ford trucks |
| 1/2"-20 | Older American vehicles |
| 7/16"-20 | Classic American |

### Seat Types
| Type | Description | Common OEMs |
|------|-------------|-------------|
| Conical (60°) | Tapered cone | Most aftermarket wheels |
| Ball/Radius | Rounded seat | BMW, Mercedes, VW/Audi OEM |
| Flat | Flat washer style | Some Toyota, Honda |
| Mag/Shank | Extended shank | Mag-style wheels |

---

## Hub Ring Matching

### Required Fields
| Field | Source | Example |
|-------|--------|---------|
| Vehicle Hub Bore | `dbProfile.centerBoreMm` | 71.5mm |
| Wheel Center Bore | `wheel.centerBore` | 73.1mm |

### Matching Logic
```typescript
function matchHubRings(dbProfile: DBFitmentProfile, wheel: WheelSpec): HubRingMatch | null {
  const vehicleHub = dbProfile.centerBoreMm;
  const wheelBore = wheel.centerBore;
  
  // No ring needed if wheel bore equals vehicle hub (OEM wheel)
  if (!vehicleHub || !wheelBore) return null;
  if (Math.abs(wheelBore - vehicleHub) < 0.5) return null;
  
  // Wheel bore must be LARGER than vehicle hub
  if (wheelBore < vehicleHub) {
    throw new Error('Wheel bore too small for vehicle');
  }
  
  // Query for hub ring: OD = wheel bore, ID = vehicle hub
  return queryHubRings({
    outerDiameter: wheelBore,
    innerDiameter: vehicleHub,
    qty: 4,
  });
}
```

### Common Hub Bore Sizes
| OD → ID | Vehicles | Notes |
|---------|----------|-------|
| 73.1 → 54.1 | Toyota, Lexus, Scion | Very common |
| 73.1 → 56.1 | Honda, Acura | Very common |
| 73.1 → 57.1 | VW, Audi | Common |
| 73.1 → 66.1 | Nissan, Infiniti | |
| 73.1 → 64.1 | Mazda, older Subaru | |
| 78.1 → 71.5 | BMW | |
| 106.1 → 78.1 | Chevy/GMC trucks | |
| 108 → 63.4 | Ford cars | |
| 125 → 106.1 | Ford trucks | Large bore |

---

## Package Builder Integration

### Data Flow
```
1. User selects vehicle
   └─ Fetch dbProfile (threadSize, seatType, centerBoreMm)

2. User selects wheel
   └─ Get wheel centerBore, seatType (if specified)

3. Auto-populate accessories
   ├─ matchLugNuts(dbProfile, wheel) → suggest lug nuts
   └─ matchHubRings(dbProfile, wheel) → suggest hub rings

4. Add to cart
   └─ { wheels, tires, lugNuts, hubRings } as package
```

### API Endpoint (proposed)
```
GET /api/accessories/match?
  threadSize=M14x1.5
  seatType=conical
  vehicleHub=71.5
  wheelBore=73.1
  qty=4

Response:
{
  lugNuts: [
    { sku: "LN-M14-CONE-BLK", name: "Black Conical Lug Nut M14x1.5", qty: 20, price: 2.50 }
  ],
  hubRings: [
    { sku: "HR-73-71", name: "Hub Ring 73.1mm → 71.5mm", qty: 4, price: 8.00 }
  ]
}
```

---

## Missing Data Handling

### If `threadSize` is null
1. Try to infer from make/model patterns
2. Show manual selection dropdown
3. Log for data enrichment

### If `seatType` is null
1. Default to "conical" (most common for aftermarket)
2. Show warning if wheel specifies different seat

### If `centerBoreMm` is null
1. Cannot auto-suggest hub rings
2. Show manual input field
3. Log for data enrichment

---

## Implementation Tasks

1. **Inventory Data**
   - [ ] Import lug nut catalog with thread/seat attributes
   - [ ] Import hub ring catalog with OD/ID dimensions

2. **API Endpoint**
   - [ ] `/api/accessories/match` endpoint
   - [ ] Query by thread size, seat type
   - [ ] Query by hub ring dimensions

3. **Frontend**
   - [ ] Accessory auto-suggest on wheel selection
   - [ ] Manual override dropdowns
   - [ ] Package summary with accessories

4. **Data Enrichment**
   - [ ] Ensure threadSize populated for all vehicles
   - [ ] Ensure seatType populated (or default rules)
   - [ ] Ensure centerBoreMm populated
