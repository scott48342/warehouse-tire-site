# Build Gallery System

**Created:** 2025-07-19
**Status:** Schema + API + UI complete, import script ready

## Overview

A build-aware gallery that connects wheel/tire build images to our fitment system. Users see "builds like this" when selecting wheels, showing real customer builds with similar vehicles and specs.

## Data Source

**Primary:** Fitment Industries Gallery (owned by WheelPros)
- URL: https://www.fitmentindustries.com/wheel-offset-gallery
- ~56,000+ builds with detailed fitment data
- Vehicle (year/make/model/trim)
- Wheel specs (brand, diameter, width, offset)
- Tire specs (brand, model, size)
- Suspension (brand, type: stock/lowering springs/coilovers/air/lift kit)
- Fitment style (flush, hellaflush, poke, tucked)
- Spacers
- Staggered setups supported

## Files

### Schema
- `src/lib/db/schema/gallery.sql` - Raw SQL schema
- `src/lib/gallery/schema.ts` - Drizzle TypeScript schema

### API
- `src/app/api/gallery/search/route.ts` - Search endpoint

### UI
- `src/components/BuildGallery.tsx` - "See builds like this" component

### Import
- `scripts/import-gallery-images.mjs` - FI gallery importer

---

## Database Schema

```sql
CREATE TABLE gallery_images (
  id UUID PRIMARY KEY,
  
  -- Image
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  blob_url TEXT,  -- Our cached copy
  
  -- Source
  source VARCHAR(50) NOT NULL,  -- 'fitment_industries', 'customer'
  source_id VARCHAR(255),
  source_url TEXT,
  
  -- Vehicle
  vehicle_year INTEGER NOT NULL,
  vehicle_make VARCHAR(100) NOT NULL,
  vehicle_model VARCHAR(100) NOT NULL,
  vehicle_trim VARCHAR(255),
  
  -- Wheel (front)
  wheel_brand VARCHAR(100),
  wheel_model VARCHAR(200),
  wheel_diameter INTEGER,
  wheel_width DECIMAL(4,1),
  wheel_offset_mm INTEGER,
  
  -- Wheel (rear - staggered)
  rear_wheel_diameter INTEGER,
  rear_wheel_width DECIMAL(4,1),
  rear_wheel_offset_mm INTEGER,
  is_staggered BOOLEAN,
  
  -- Tire
  tire_brand VARCHAR(100),
  tire_model VARCHAR(200),
  tire_size VARCHAR(50),
  rear_tire_size VARCHAR(50),
  
  -- Suspension/Lift
  suspension_type VARCHAR(30),   -- stock, lowering_springs, coilovers, air, lift_kit
  suspension_brand VARCHAR(100),
  lift_level VARCHAR(30),        -- stock, leveled, lifted, lowered, slammed
  
  -- Fitment
  fitment_type VARCHAR(30),      -- flush, hellaflush, poke, tucked
  build_style VARCHAR(30),       -- aggressive, daily, show, offroad
  
  -- Metadata
  title VARCHAR(255),
  tags TEXT[],
  view_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active'
);
```

---

## API Endpoint

### `GET /api/gallery/search`

Search gallery images matching vehicle and build specs.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| year | number | Vehicle year (matches ±2 years) |
| make | string | Vehicle make (exact, case-insensitive) |
| model | string | Vehicle model (fuzzy match) |
| wheelDiameter | number | Wheel diameter (exact) |
| wheelBrand | string | Wheel brand (fuzzy) |
| liftLevel | string | stock, leveled, lifted, lowered |
| fitmentType | string | flush, hellaflush, poke, tucked |
| limit | number | Max results (default: 12, max: 50) |
| offset | number | Pagination offset |

**Response:**
```json
{
  "images": [
    {
      "id": "uuid",
      "imageUrl": "https://...",
      "thumbnailUrl": "https://...",
      "vehicle": { "year": 2024, "make": "Ford", "model": "F-150", "trim": "XLT" },
      "wheel": { "brand": "Fuel", "diameter": 20, "width": 10, "offsetMm": -18 },
      "tire": { "brand": "Nitto", "size": "33x12.50R20" },
      "suspension": { "type": "lift_kit", "brand": "Rough Country", "liftLevel": "leveled" },
      "fitment": { "type": "poke", "style": "offroad", "isStaggered": false }
    }
  ],
  "pagination": { "total": 156, "limit": 12, "offset": 0, "hasMore": true }
}
```

---

## UI Component

### `<BuildGallery />`

Displays matching builds in a horizontal carousel with lightbox.

**Props:**
```tsx
interface BuildGalleryProps {
  year?: number;
  make?: string;
  model?: string;
  wheelDiameter?: number;
  wheelBrand?: string;
  liftLevel?: "stock" | "leveled" | "lifted" | "lowered";
  limit?: number;      // Default: 6
  showTitle?: boolean; // Default: true
  compact?: boolean;   // Smaller cards
}
```

**Usage:**
```tsx
// On wheel selection page
<BuildGallery 
  year={2024} 
  make="Ford" 
  model="F-150" 
  wheelDiameter={20}
  liftLevel="leveled"
/>

// On results page (after build complete)
<BuildGallery 
  year={vehicle.year} 
  make={vehicle.make} 
  model={vehicle.model}
  wheelDiameter={selectedWheel.diameter}
  limit={8}
/>
```

---

## Integration Points

### 1. Wheel Selection Page
Show after user selects vehicle, filtered by:
- Same make/model
- Similar year range
- Selected wheel diameter (if known)
- Selected lift level (if truck)

### 2. Package Results Page
Show matching builds based on:
- Complete build specs (wheel + tire + lift)
- "Customers with this truck also got..."

### 3. Product Detail Pages (PDP)
Show builds featuring the specific wheel/tire:
- Filter by `wheelBrand`
- "See this wheel on real vehicles"

---

## Import Process

### Phase 1: Initial Import
1. Scrape Fitment Industries gallery pages
2. Parse vehicle/wheel/tire/suspension data
3. Store in `gallery_images` table
4. Cache images to Vercel Blob (optional)

### Phase 2: Ongoing Sync
- Daily cron job to fetch new gallery entries
- Dedupe by `source` + `source_id`
- Update existing records if data changes

### Running Import
```bash
# Dry run (parse only)
node scripts/import-gallery-images.mjs

# Live import
node scripts/import-gallery-images.mjs --live

# Filter by vehicle
node scripts/import-gallery-images.mjs --make=Ford --model=F-150 --live
```

---

## Example Queries

### Find builds for a lifted F-150 with 20" wheels
```sql
SELECT * FROM gallery_images 
WHERE vehicle_make ILIKE 'Ford' 
  AND vehicle_model ILIKE 'F-150%'
  AND vehicle_year BETWEEN 2021 AND 2024
  AND wheel_diameter = 20
  AND lift_level IN ('leveled', 'lifted')
  AND status = 'active'
ORDER BY featured DESC, view_count DESC
LIMIT 12;
```

### Popular wheel brands for Mustangs
```sql
SELECT wheel_brand, COUNT(*) as count
FROM gallery_images
WHERE vehicle_model ILIKE '%Mustang%'
  AND status = 'active'
GROUP BY wheel_brand
ORDER BY count DESC
LIMIT 10;
```

---

## Next Steps

1. [ ] Run schema migration to create `gallery_images` table
2. [ ] Implement FI gallery scraper (or use their API if available)
3. [ ] Import initial dataset (start with top 10 trucks)
4. [ ] Add `<BuildGallery>` to wheel selection flow
5. [ ] A/B test impact on conversion
6. [ ] Add customer submission flow (Phase 2)
