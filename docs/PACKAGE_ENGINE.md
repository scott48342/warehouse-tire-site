# Package Engine - Conversion Optimization Implementation

## Overview

Built a package-first buying experience to increase add-to-cart rate and AOV. The system generates curated wheel + tire packages based on vehicle fitment data.

## Files Created

### 1. Package Engine (Core Logic)
**`src/lib/packages/engine.ts`** (~23KB)

Core function: `getRecommendedPackages({ year, make, model, trim? })`

**Package Categories:**
- `daily_driver` - OEM-equivalent, all-season comfort
- `sport_aggressive` - Plus-size wheels (+1-2"), performance tires
- `premium_look` - Larger diameter, premium brands
- `offroad_lifted` - Aggressive offset, A/T tires (trucks/SUVs only)

**Each Package Includes:**
```typescript
interface RecommendedPackage {
  id: string;
  name: string;
  category: PackageCategory;
  categoryLabel: string;
  wheel: {
    sku: string;
    brand: string;
    model: string;
    finish?: string;
    diameter: number;
    width: number;
    offset: number;
    price: number;
    imageUrl: string | null;
    boltPattern: string;
  };
  tire: {
    size: string;
    brand: string;
    model: string;
    price: number;
    imageUrl: string | null;
  };
  totalPrice: number;           // 4 wheels + 4 tires
  fitmentValidation: {
    safe: boolean;
    notes: string[];
    overallDiameterChange?: number;
    offsetFromOEM?: number;
  };
  overallDiameter: number;
  oemOverallDiameter: number;
  offsetRange: { min: number; max: number };
  sizeSpec: string;             // e.g., "20x9 / 275/55R20"
  availability: "in_stock" | "limited" | "check_availability";
  score: number;
}
```

**Safety Rules (NEVER bypassed):**
- Overall diameter must be within ±3% of OEM
- Offset must be within safe range for vehicle
- Bolt pattern must match exactly

### 2. API Route
**`src/app/api/packages/recommended/route.ts`**

```
GET /api/packages/recommended?year=2024&make=Ford&model=F-150&trim=XLT
```

Returns recommended packages with timing metrics.

### 3. UI Components

**`src/components/packages/RecommendedPackages.tsx`** (~10KB)
- Horizontal scrollable card layout
- Loading skeleton state
- Empty state (fails gracefully, shows nothing)
- Category badges with icons
- Fitment Guaranteed badge
- Price prominent
- Select Package CTA

**`src/components/packages/index.ts`**
- Export file for clean imports

**`src/components/TrustBadges.tsx`** (~9KB)
- Reusable trust badge system
- Types: `fitment_guaranteed`, `verified_vehicle`, `no_rubbing`, `free_shipping`, `price_match`, `expert_support`
- Components: `TrustBadge`, `TrustBadgesRow`, `TrustBadgesStack`, `TrustBar`, `CartTrustSection`

**`src/components/CompleteYourSetup.tsx`** (~10KB)
- Accessory upsell component
- Default accessories: TPMS, Lug Nuts, Valve Stems, Hub Rings
- Add to cart functionality
- Collapsible for cart page

### 4. Package Customization Page
**`src/app/package/customize/page.tsx`**
**`src/app/package/customize/PackageCustomizer.tsx`** (~15KB)

- Pre-loads wheel + tire from selected package
- Allows swapping tire brand (same size)
- Shows alternative tire options
- CompleteYourSetup integration
- Add to cart with vehicle context

## Integration Points

### Updated Pages:

1. **`/wheels/for/[vehicleSlug]/page.tsx`**
   - Added `<RecommendedPackages />` after intro section
   - Shows 4 packages when vehicle has fitment data

2. **`/tires/for/[vehicleSlug]/page.tsx`**
   - Added `<RecommendedPackages />` before trim selector
   - Shows 4 packages

3. **`/packages/for/[vehicleSlug]/page.tsx`**
   - Added `<RecommendedPackages />` as main content
   - Shows 6 packages (no title, full display)

4. **`/cart/page.tsx`**
   - Added `<CartAccessoryUpsell />` for accessory recommendations
   - Added `<CartTrustSection />` in sidebar

### Navigation Flow:
1. User lands on vehicle page (wheels/tires/packages)
2. Sees recommended packages at top
3. Clicks "Select Package"
4. Goes to `/package/customize?packageId=...`
5. Can swap tire brand, add accessories
6. Adds to cart

## Algorithm Details

### Package Generation Logic:
1. Get vehicle fitment (bolt pattern, OEM sizes, offset range)
2. Query wheels that fit from Techfeed database
3. For each category:
   - Find best wheel matching criteria (brand preference, price range, offset)
   - Calculate compatible tire size
   - Validate overall diameter (±3% of OEM)
   - Validate offset safety
   - Score and rank
4. Return top 6 packages

### Wheel Scoring Factors:
- Preferred brands (tier 1: Fuel, Moto Metal, XD, KMC, etc.)
- Price range match
- Offset preference (OEM for daily, aggressive for lifted)
- Image availability

### Tire Size Calculation:
- Uses OEM tire sizes when available for matching diameter
- For plus-sizing, calculates aspect ratio to maintain overall diameter
- Snaps to common widths/aspect ratios

## Test Script
**`scripts/test-packages.ts`**

Tests vehicles:
- 2024 Ford F-150
- 2024 Toyota Camry  
- 2024 Honda Civic
- 2024 Chevrolet Silverado 1500
- 2024 Toyota RAV4

Run with: `npx tsx scripts/test-packages.ts`
(Requires database connection - run in dev server context)

## Validation Requirements

For packages to show:
1. Vehicle must have fitment data in database
2. Bolt pattern must be present
3. Wheels must match bolt pattern
4. Fitment validation must pass (safe: true)

## Sample API Response

```json
{
  "packages": [
    {
      "id": "daily_driver-FM-D538-20X9",
      "name": "Daily Driver",
      "category": "daily_driver",
      "wheel": {
        "sku": "FM-D538-20X9",
        "brand": "Fuel",
        "model": "Maverick",
        "diameter": 20,
        "width": 9,
        "offset": 1,
        "price": 289
      },
      "tire": {
        "size": "275/55R20",
        "brand": "TBD",
        "model": "All-Season",
        "price": 220
      },
      "totalPrice": 2036,
      "fitmentValidation": {
        "safe": true,
        "notes": ["Perfect fitment - within all OEM specifications"]
      },
      "sizeSpec": "20x9 / 275/55R20",
      "availability": "in_stock"
    }
  ],
  "vehicle": { "year": 2024, "make": "Ford", "model": "F-150" },
  "fitment": {
    "boltPattern": "6x135",
    "oemDiameters": [17, 18, 20],
    "oemTireSizes": ["265/70R17", "275/65R18", "275/55R20"],
    "offsetRange": { "min": 25, "max": 44 }
  },
  "timing": { "totalMs": 245, "fitmentMs": 12, "wheelsMs": 180, "packagesMs": 53 }
}
```

## Future Enhancements

1. **Live Tire Pricing** - Currently uses estimates, could query Tirewire/K&M
2. **Visual Preview** - Show wheel on vehicle using existing visual fitment system
3. **A/B Testing** - Track conversion rates for package-first vs traditional
4. **Personalization** - Learn user preferences, show relevant packages first
