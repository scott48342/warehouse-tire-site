# Fitment Override System

Manual override system for fixing unresolved or incomplete vehicle fitment profiles without code changes.

## Overview

The Wheel-Size API sometimes returns incomplete or incorrect data for certain vehicles. Instead of hardcoding fixes, we use a structured override system that:

1. Stores override rules in the database
2. Applies them at profile resolution time
3. Supports different scope levels (global → specific)
4. Can force quality assessment to bypass validation

## API Endpoints

### `GET /api/admin/fitment-override`

List all active overrides:
```bash
curl http://localhost:3000/api/admin/fitment-override
```

Get specific override by ID:
```bash
curl 'http://localhost:3000/api/admin/fitment-override?id=<uuid>'
```

Find override for a vehicle:
```bash
curl 'http://localhost:3000/api/admin/fitment-override?year=2003&make=Chevrolet&model=Avalanche%201500&modification=z71-5-3l-v8'
```

### `POST /api/admin/fitment-override`

Create a new override:
```bash
curl -X POST http://localhost:3000/api/admin/fitment-override \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "modification",
    "year": 2003,
    "make": "Chevrolet",
    "model": "Avalanche 1500",
    "modificationId": "z71-5-3l-v8",
    "boltPattern": "6x139.7",
    "centerBoreMm": 78.1,
    "threadSize": "M14x1.5",
    "seatType": "conical",
    "offsetMinMm": 15,
    "offsetMaxMm": 35,
    "oemWheelSizes": [
      {"diameter": 16, "width": 7, "offset": 31, "axle": "both", "isStock": true, "tireSize": "265/75R16"},
      {"diameter": 17, "width": 7.5, "offset": 28, "axle": "both", "isStock": true, "tireSize": "265/70R17"}
    ],
    "oemTireSizes": ["265/75R16", "265/70R17"],
    "forceQuality": "valid",
    "reason": "API returns incomplete data, manually researched specs",
    "notes": "Verified against GM service manual",
    "createdBy": "admin"
  }'
```

### `PATCH /api/admin/fitment-override?id=<uuid>`

Update an existing override:
```bash
curl -X PATCH 'http://localhost:3000/api/admin/fitment-override?id=<uuid>' \
  -H "Content-Type: application/json" \
  -d '{"boltPattern": "6x139.7", "reason": "Updated bolt pattern"}'
```

### `DELETE /api/admin/fitment-override?id=<uuid>`

Deactivate an override (soft delete):
```bash
curl -X DELETE 'http://localhost:3000/api/admin/fitment-override?id=<uuid>'
```

## Override Schema

```typescript
interface FitmentOverride {
  // Identity
  id: string;           // UUID
  
  // Scope determines specificity
  scope: "global" | "year" | "make" | "model" | "modification";
  
  // Match criteria (required fields depend on scope)
  year?: number;          // Required for: year, modification
  make?: string;          // Required for: make, model, modification
  model?: string;         // Required for: model, modification
  modificationId?: string; // Required for: modification
  
  // Override values (null = don't override this field)
  displayTrim?: string;
  boltPattern?: string;      // e.g. "6x139.7"
  centerBoreMm?: number;     // e.g. 78.1
  threadSize?: string;       // e.g. "M14x1.5"
  seatType?: string;         // e.g. "conical", "ball", "flat"
  offsetMinMm?: number;      // Minimum safe offset
  offsetMaxMm?: number;      // Maximum safe offset
  
  // Extended fields
  oemWheelSizes?: OEMWheelSize[]; // Replace OEM wheel sizes
  oemTireSizes?: string[];        // Replace OEM tire sizes
  forceQuality?: "valid" | "partial"; // Bypass quality assessment
  
  // Metadata
  reason: string;         // Why this override exists (required)
  notes?: string;         // Additional context
  createdBy: string;      // Who created it
  active: boolean;        // Soft delete flag
  createdAt: Date;
  updatedAt: Date;
}

interface OEMWheelSize {
  diameter: number;      // e.g. 17
  width: number;         // e.g. 7.5
  offset: number | null; // e.g. 28
  tireSize?: string;     // e.g. "265/70R17"
  axle: "front" | "rear" | "both";
  isStock: boolean;
}
```

## Scope Priority

Overrides are applied with most-specific-wins:

| Scope | Priority | Matches |
|-------|----------|---------|
| `modification` | 5 | Exact year/make/model/modificationId |
| `model` | 4 | All modifications for year/make/model |
| `make` | 3 | All models for year/make |
| `year` | 2 | All makes for year |
| `global` | 1 | Everything |

When multiple overrides match, they're applied in order (least specific first), so more specific overrides win.

## Quality Forcing

The `forceQuality` field bypasses normal quality assessment:

- `null` (default): Profile is assessed normally based on data completeness
- `"valid"`: Force profile to be considered valid, even with incomplete data
- `"partial"`: Force profile to be considered partial

This is useful when:
- API data is incomplete but you've verified the override provides enough info
- You want to make a vehicle usable immediately without fixing all fields

## Example: Unresolved Vehicle

### Before Override (INVALID profile)

```json
{
  "vehicle": "2003 Chevrolet Avalanche 1500 Z71",
  "boltPattern": null,
  "centerBoreMm": null,
  "threadSize": null,
  "oemWheelSizes": [],
  "oemTireSizes": [],
  "quality": "INVALID",
  "reason": "Missing boltPattern - cannot match any wheels"
}
```

### After Override (VALID profile)

```json
{
  "vehicle": "2003 Chevrolet Avalanche 1500 Z71",
  "boltPattern": "6x139.7",
  "centerBoreMm": 78.1,
  "threadSize": "M14x1.5",
  "seatType": "conical",
  "offsetRange": { "min": 15, "max": 35 },
  "oemWheelSizes": [
    { "diameter": 16, "width": 7, "offset": 31, "axle": "both", "tireSize": "265/75R16" },
    { "diameter": 17, "width": 7.5, "offset": 28, "axle": "both", "tireSize": "265/70R17" }
  ],
  "oemTireSizes": ["265/75R16", "265/70R17"],
  "quality": "VALID",
  "overridesApplied": true,
  "forceQuality": "valid"
}
```

## Wheels Page Result

Without override:
```
❌ "No fitment profile found" error
   Vehicle shows as unresolved
   Cannot search for wheels
```

With override:
```
✅ 150+ wheels matching bolt pattern
   Proper surefit/specfit classification
   OEM tire sizes shown for reference
```

## Database Schema

```sql
CREATE TABLE fitment_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  scope VARCHAR(20) NOT NULL,
  year INTEGER,
  make VARCHAR(100),
  model VARCHAR(100),
  modification_id VARCHAR(255),
  
  display_trim VARCHAR(255),
  bolt_pattern VARCHAR(20),
  center_bore_mm DECIMAL(5, 1),
  thread_size VARCHAR(20),
  seat_type VARCHAR(20),
  offset_min_mm DECIMAL(5, 2),
  offset_max_mm DECIMAL(5, 2),
  oem_wheel_sizes JSONB,
  oem_tire_sizes JSONB,
  force_quality VARCHAR(20),
  notes TEXT,
  
  reason TEXT NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Seeding Example Override

```bash
npx tsx scripts/seed-avalanche-override.ts
```

This creates:
1. An unresolved fitment record for 2003 Avalanche 1500
2. An override that fixes it with researched specs

## Troubleshooting

### Override not applying?

1. Check scope matches the vehicle exactly
2. Verify `active: true` on the override
3. Check normalization: make/model are lowercased, modificationId is slugified

### Still showing as invalid?

1. Add `forceQuality: "valid"` to bypass assessment
2. Ensure boltPattern is provided (required for any wheel matching)

### Multiple overrides conflicting?

More specific scopes always win. If you need to override a specific modification differently than the model-level override, create a modification-scope override.
