# Classic Fitment Framework v1

**Release Tag:** `classic-fitment-v1`  
**Date:** 2026-03-31  
**Status:** Locked for UI development

---

## Overview

The Classic Fitment Framework provides platform-based wheel fitment data for vintage/classic American muscle cars. It is **completely isolated** from the modern `vehicle_fitments` system.

## Architecture

### Database
- **Table:** `classic_fitments`
- **Isolation:** No foreign keys to `vehicle_fitments`
- **Rollback:** Surgical via `batch_tag` + `is_active` flag

### API
- **Endpoint:** `GET /api/classic/fitment?year=&make=&model=`
- **Response:** Platform-based fitment with confidence tier

### Key Files
```
src/lib/classic-fitment/
├── schema.ts          # Drizzle schema
├── types.ts           # TypeScript interfaces
├── classicLookup.ts   # Platform lookup logic
├── classicImport.ts   # Import with validation
└── index.ts           # Exports

src/app/api/classic/fitment/route.ts   # API endpoint
drizzle/migrations/0010_create_classic_fitments.sql
```

---

## Supported Platforms (v1)

### GM Platforms

| Platform Code | Platform Name | Vehicles | Years | Bolt Pattern | CB | Thread |
|---------------|---------------|----------|-------|--------------|-----|--------|
| `gm-f-body-1` | GM F-Body 1st Gen | Camaro, Firebird | 1967-1969 | 5x120.65 | 70.3mm | 7/16-20 |
| `gm-f-body-2` | GM F-Body 2nd Gen | Camaro, Firebird, Trans Am | 1970-1981 | 5x120.65 | 70.3mm | 7/16-20 |
| `gm-a-body-2` | GM A-Body 2nd Gen | Chevelle, GTO, Cutlass, 442, Skylark | 1968-1972 | 5x120.65 | 70.3mm | 7/16-20 |

### Ford Platforms

| Platform Code | Platform Name | Vehicles | Years | Bolt Pattern | CB | Thread |
|---------------|---------------|----------|-------|--------------|-----|--------|
| `ford-mustang-1gen` | Ford Mustang 1st Gen | Mustang, Cougar | 1964-1973 | 5x114.3 | 70.6mm | 1/2-20 |

### Mopar Platforms

| Platform Code | Platform Name | Vehicles | Years | Bolt Pattern | CB | Thread |
|---------------|---------------|----------|-------|--------------|-----|--------|
| `mopar-e-body` | Mopar E-Body | Challenger, Barracuda | 1970-1974 | 5x114.3 | 71.5mm | 1/2-20 |
| `mopar-b-body` | Mopar B-Body | Road Runner, Charger, GTX, Coronet, Super Bee | 1968-1970 | 5x114.3 | 71.5mm | 1/2-20 |

---

## Vehicle Records (19 total)

| Make | Model | Platform | Years |
|------|-------|----------|-------|
| Chevrolet | Camaro | gm-f-body-1 | 1967-1969 |
| Pontiac | Firebird | gm-f-body-1 | 1967-1969 |
| Chevrolet | Camaro | gm-f-body-2 | 1970-1981 |
| Pontiac | Firebird | gm-f-body-2 | 1970-1981 |
| Pontiac | Trans Am | gm-f-body-2 | 1970-1981 |
| Chevrolet | Chevelle | gm-a-body-2 | 1968-1972 |
| Pontiac | GTO | gm-a-body-2 | 1968-1972 |
| Oldsmobile | Cutlass | gm-a-body-2 | 1968-1972 |
| Oldsmobile | 442 | gm-a-body-2 | 1968-1972 |
| Buick | Skylark | gm-a-body-2 | 1968-1972 |
| Ford | Mustang | ford-mustang-1gen | 1964-1973 |
| Mercury | Cougar | ford-mustang-1gen | 1967-1973 |
| Dodge | Challenger | mopar-e-body | 1970-1974 |
| Plymouth | Barracuda | mopar-e-body | 1970-1974 |
| Plymouth | Road Runner | mopar-b-body | 1968-1970 |
| Dodge | Charger | mopar-b-body | 1968-1970 |
| Plymouth | GTX | mopar-b-body | 1968-1970 |
| Dodge | Coronet | mopar-b-body | 1968-1970 |
| Dodge | Super Bee | mopar-b-body | 1968-1970 |

---

## Batch Tags (for rollback)

| Batch Tag | Platform | Records |
|-----------|----------|---------|
| `classic-gm-f-body-1-v1` | GM F-Body 1st Gen | 2 |
| `classic-gm-f-body-2-v1` | GM F-Body 2nd Gen | 3 |
| `classic-gm-a-body-2-v1` | GM A-Body 2nd Gen | 5 |
| `classic-ford-mustang-1gen-v1` | Ford Mustang 1st Gen | 2 |
| `classic-mopar-e-body-v1` | Mopar E-Body | 2 |
| `classic-mopar-b-body-v1` | Mopar B-Body | 5 |

### Rollback Commands
```sql
-- Rollback single platform
UPDATE classic_fitments SET is_active = false WHERE batch_tag = 'classic-gm-f-body-1-v1';

-- Rollback all v1 imports
UPDATE classic_fitments SET is_active = false WHERE batch_tag LIKE 'classic-%-v1';

-- Full table disable (emergency)
UPDATE classic_fitments SET is_active = false;
```

---

## API Response Structure

```json
{
  "isClassicVehicle": true,
  "fitmentMode": "classic",
  "platform": {
    "code": "gm-f-body-2",
    "name": "GM F-Body 2nd Generation",
    "generationName": "1970-1981 Pony Car Era",
    "yearRange": "1970-1981"
  },
  "vehicle": { "year": 1977, "make": "pontiac", "model": "trans-am" },
  "fitmentStyle": "stock_baseline",
  "confidence": "high",
  "verificationRequired": true,
  "verificationNote": "...",
  "commonModifications": ["..."],
  "modificationRisk": "low",
  "specs": {
    "boltPattern": "5x120.65",
    "centerBore": 70.3,
    "threadSize": "7/16-20",
    "seatType": "conical"
  },
  "recommendedRange": {
    "diameter": { "min": 14, "max": 17 },
    "width": { "min": 6, "max": 9 },
    "offset": { "min": -6, "max": 12 }
  },
  "stockReference": {
    "wheelDiameter": 15,
    "wheelWidth": 7,
    "tireSize": "F60-15 / 225/70R15 / 245/60R15"
  },
  "source": "classic-platform-baseline",
  "batchTag": "classic-gm-f-body-2-v1",
  "version": 1
}
```

---

## Not Covered (v1)

- GM F-Body 3rd Gen (1982-1992)
- Ford Mustang 2nd Gen / Mustang II (1974-1978)
- AMC (Javelin, AMX)
- Japanese classics (Datsun Z, early Toyota)
- European classics
- Trucks/SUVs

---

## Migration Notes

The `classic_fitments` table was created via:
```
drizzle/migrations/0010_create_classic_fitments.sql
```

Indexes created:
- `classic_fitments_platform_make_model_idx` (unique)
- `classic_fitments_platform_idx`
- `classic_fitments_make_model_idx`
- `classic_fitments_year_range_idx`
- `classic_fitments_batch_idx`
- `classic_fitments_active_idx`

---

## Testing Checklist

- [ ] Modern vehicle returns `isClassicVehicle: false`
- [ ] Classic vehicle returns full platform data
- [ ] Year boundary returns 404 for out-of-range
- [ ] Overlapping generations route correctly (1969 Camaro → 1st gen, 1970 → 2nd gen)
- [ ] Modern wheel search unaffected
- [ ] Rollback by batch_tag works
