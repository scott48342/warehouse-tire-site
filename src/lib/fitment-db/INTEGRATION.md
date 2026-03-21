# Fitment DB Integration Guide

## Overview

The fitment-db module provides DB-first fitment lookups with automatic Wheel-Size API fallback and import.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Request                                  │
│                 /api/vehicles/trims?year=2022&make=Ford&model=F-150 │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      getTrimOptions()                                │
│                   src/lib/fitment-db/getFitment.ts                  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             │
┌───────────────────────────────┐                 │
│     Check Database First      │                 │
│   vehicle_fitments table      │                 │
└───────────────┬───────────────┘                 │
                │                                 │
         Found? ├──── YES ────────────────┐       │
                │                         │       │
                NO                        │       │
                │                         │       │
                ▼                         │       │
┌───────────────────────────────┐         │       │
│   Call Wheel-Size API         │         │       │
│   (automatic fallback)        │         │       │
└───────────────┬───────────────┘         │       │
                │                         │       │
                ▼                         │       │
┌───────────────────────────────┐         │       │
│   Import to Database          │         │       │
│   - fitment_source_records    │         │       │
│   - vehicle_fitments          │         │       │
└───────────────┬───────────────┘         │       │
                │                         │       │
                └─────────────────────────┼───────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │   Apply Overrides             │
                          │   fitment_overrides table     │
                          └───────────────┬───────────────┘
                                          │
                                          ▼
                          ┌───────────────────────────────┐
                          │   Return Normalized Result    │
                          │   { value, label }[]          │
                          └───────────────────────────────┘
```

## Integration with Current Trims Route

### Before (current)

```typescript
// src/app/api/vehicles/trims/route.ts
export async function GET(req: Request) {
  // ... calls Wheel-Size API every time
  // ... uses submodel-supplements.json for fallback
}
```

### After (with fitment-db)

```typescript
// src/app/api/vehicles/trims/route.ts
import { getTrimOptions } from "@/lib/fitment-db";
import { getSubmodelSupplement } from "./supplements"; // Keep as fallback

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const make = url.searchParams.get("make") || "";
  const model = url.searchParams.get("model") || "";

  if (!year || !make || !model) {
    return NextResponse.json({ results: [] });
  }

  try {
    // DB-first lookup with automatic API fallback
    const options = await getTrimOptions(year, make, model);
    
    if (options.length > 0) {
      return NextResponse.json({ results: options });
    }
    
    // Fallback to static supplements (for trucks, etc.)
    const supplement = getSubmodelSupplement(year, make, model);
    if (supplement && supplement.length > 0) {
      return NextResponse.json({ results: supplement });
    }
    
    return NextResponse.json({ results: [] });
  } catch (error) {
    console.error("[trims] Error:", error);
    return NextResponse.json({ results: [] });
  }
}
```

## Database Tables

### fitment_source_records
Raw API responses stored for debugging and reprocessing.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| source | VARCHAR | API source (wheelsize, wheelpros, etc.) |
| source_id | VARCHAR | External ID (e.g., modification slug) |
| year | INTEGER | Vehicle year |
| make | VARCHAR | Normalized make |
| model | VARCHAR | Normalized model |
| raw_payload | JSONB | Full API response |
| fetched_at | TIMESTAMP | When fetched |
| checksum | VARCHAR | SHA256 for change detection |

### vehicle_fitments
Normalized fitment data for runtime lookups.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| year | INTEGER | Vehicle year |
| make | VARCHAR | Normalized make |
| model | VARCHAR | Normalized model |
| modification_id | VARCHAR | Unique per variant |
| raw_trim | VARCHAR | Original from source |
| display_trim | VARCHAR | Customer-facing label |
| bolt_pattern | VARCHAR | e.g., "5x120" |
| center_bore_mm | DECIMAL | Hub bore size |
| thread_size | VARCHAR | e.g., "M14x1.5" |
| seat_type | VARCHAR | conical, ball, flat |
| offset_min_mm | INTEGER | Min offset range |
| offset_max_mm | INTEGER | Max offset range |
| oem_wheel_sizes | JSONB | Array of OEM wheel specs |
| oem_tire_sizes | JSONB | Array of OEM tire specs |
| source | VARCHAR | Data source |
| last_verified_at | TIMESTAMP | Last verification |

### fitment_overrides
Manual corrections to source data.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| scope | VARCHAR | global, year, make, model, modification |
| year | INTEGER | Match year (null = wildcard) |
| make | VARCHAR | Match make |
| model | VARCHAR | Match model |
| modification_id | VARCHAR | Match modification |
| display_trim | VARCHAR | Override trim label |
| ... | ... | Other override fields |
| reason | TEXT | Why override exists |
| created_by | VARCHAR | Who created it |
| active | BOOLEAN | Is override active |

## Setup Instructions

### 1. Create Vercel Postgres Database

```bash
# Via Vercel Dashboard or CLI
vercel env pull  # Get POSTGRES_URL
```

### 2. Run Migration

```bash
# Using psql
psql $POSTGRES_URL -f drizzle/migrations/0001_create_fitment_tables.sql

# Or via Drizzle
npx drizzle-kit push
```

### 3. Update Environment Variables

```env
POSTGRES_URL=postgres://...
```

### 4. Update Trims Route

Replace the current implementation with the DB-first approach shown above.

## Import Existing Data

### Manual Import (single vehicle)

```typescript
import { importWheelSizeFitment } from "@/lib/fitment-db";

await importWheelSizeFitment(
  2022,
  "Ford",
  "F-150",
  { slug: "xl", trim: "XL", name: "XL" },
  wheelData,
  tireData,
  fullApiResponse
);
```

### Batch Import

```typescript
import { createImportJob, importFromWheelSize } from "@/lib/fitment-db";

const jobId = await createImportJob("wheelsize", 2020, 2024, ["ford", "chevrolet"]);
await importFromWheelSize(jobId, {
  yearStart: 2020,
  yearEnd: 2024,
  makes: ["ford", "chevrolet"],
  apiKey: process.env.WHEELSIZE_API_KEY!,
});
```

## Override Examples

### Fix display trim for all Camaros with 5.7L engine

```typescript
import { createOverride } from "@/lib/fitment-db";

await createOverride({
  scope: "model",
  make: "chevrolet",
  model: "camaro",
  displayTrim: "Z28",
  reason: "5.7L Camaros are Z28 trim",
  createdBy: "admin",
});
```

### Fix bolt pattern for specific modification

```typescript
await createOverride({
  scope: "modification",
  year: 2022,
  make: "ford",
  model: "f-150",
  modificationId: "raptor",
  boltPattern: "6x135",
  reason: "Raptor uses 6x135 bolt pattern",
  createdBy: "admin",
});
```
