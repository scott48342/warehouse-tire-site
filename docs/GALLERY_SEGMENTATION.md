# Gallery Segmentation System

**Date:** 2026-04-20  
**Purpose:** Support both truck/SUV and car gallery matching without cross-contamination

## Overview

The gallery system now segments by vehicle type:

| Vehicle Type | Gallery Block | API | UI Text | Build Types |
|-------------|---------------|-----|---------|-------------|
| Truck | `BuildGalleryBlock` | `/api/gallery/builds` | "See builds like this" | stock/leveled/lifted |
| SUV | `BuildGalleryBlock` | `/api/gallery/builds` | "See builds like this" | stock/leveled/lifted |
| Jeep | `BuildGalleryBlock` | `/api/gallery/builds` | "See builds like this" | stock/leveled/lifted |
| **Car** | `WheelGalleryBlock` | `/api/gallery/match` | "See this wheel on real vehicles" | **N/A** |

## Vehicle Type Detection

The system detects vehicle type from make/model:

### Trucks
- F-150, F-250, F-350, Silverado, Sierra, Ram 1500/2500/3500
- Tundra, Tacoma, Ranger, Colorado, Gladiator
- Titan, Frontier, Canyon, Ridgeline, Maverick, Santa Cruz

### SUVs
- Bronco, 4Runner, Tahoe, Suburban, Yukon, Escalade
- Sequoia, Land Cruiser, GX, Expedition, Durango, Armada
- Pilot, Highlander, Explorer, Telluride, Palisade, Pathfinder

### Jeeps
- Any Jeep make, Wrangler, Rubicon
- Cherokee, Grand Cherokee, Compass, Renegade

### Cars
- **Muscle/Performance:** Mustang, Camaro, Challenger, Charger, Corvette
- **Sports:** 911, Cayman, Supra, Z4, 86, BRZ, Miata, 370Z/400Z
- **BMW M:** M2, M3, M4, M5
- **Sedans:** Accord, Camry, Civic, Corolla, Altima, 3/5/7 Series
- **Hot Hatches:** Golf, GTI, WRX, STI, Type R

## Cross-Contamination Prevention

### Rule 1: Cars never see truck images
When `vehicleType === "car"`:
- `BuildGalleryBlock` returns **nothing** (short-circuits before API call)
- `/api/gallery/builds` returns `{ results: [], reason: "Car vehicle - use wheel gallery instead of build gallery" }`
- `WheelGalleryBlock` only queries car images from the database

### Rule 2: Trucks never see car images  
When `vehicleType === "truck" | "suv" | "jeep"`:
- `BuildGalleryBlock` only queries truck/suv/jeep images
- `/api/gallery/match` fallback query filters to `vehicle_type IN ('truck', 'suv', 'jeep')`

## Example Behaviors

### Truck PDP (F-150 + lifted)
```
[Wheels SRP]
├── BuildGalleryBlock
│   ├── Shows: 🔧 "See builds like this"
│   ├── Images: F-150s, Silverados, Rams with lifts
│   └── Match: Same vehicle type + similar lift level
```

### Car PDP (Mustang)
```
[Wheels SRP]
├── WheelGalleryBlock
│   ├── Shows: "See this wheel on real vehicles"
│   ├── Images: Mustangs, Camaros, sports cars
│   └── Match: Same wheel model + car vehicle type
```

### Stock Build (any vehicle)
```
[Wheels SRP]
├── No gallery shown (stock builds don't need inspiration)
```

## Files Modified

1. **`/api/gallery/builds/route.ts`**
   - Added car detection to `inferVehicleType()`
   - Returns early with explanation if vehicle is a car
   - Ensures fallback only shows truck/suv/jeep images

2. **`/api/gallery/match/route.ts`**
   - Added car detection to `inferVehicleType()`
   - Fallback query segments by vehicle type
   - Cars get car images, trucks get truck images

3. **`BuildGalleryBlock.tsx`**
   - Added client-side `inferVehicleTypeClient()`
   - Short-circuits before API call if vehicle is car
   - Double-protection against showing truck builds to car shoppers

4. **`WheelGalleryBlock.tsx`**
   - Added client-side `inferVehicleTypeClient()`
   - Passes inferred vehicle type to API
   - Ensures proper segmentation in all cases

5. **`wheels/page.tsx`**
   - Conditionally renders `BuildGalleryBlock` for trucks/SUVs/Jeeps
   - Conditionally renders `WheelGalleryBlock` for cars
   - Explicit `fitmentVehicleType !== "car"` check

## Testing

Run the segmentation test:
```bash
cd scripts
node test-gallery-segmentation.mjs
```

This verifies:
- ✅ Trucks get truck/suv/jeep images
- ✅ Cars get car images (or empty if no car images in gallery)
- ❌ FAIL if truck images appear in car context
- ❌ FAIL if car images appear in truck context
