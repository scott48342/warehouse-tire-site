# Tire Validation + Trim Enrichment Phase

## Status: Waiting for wheel research to complete

## Scope (Updated)
1. **Validate tire sizes** against OEM specs
2. **Capture trim-level differences** for wheel/tire specs
3. **Flag staggered setups** with front/rear tire sizes
4. **Associate wheel sizes with trims** (e.g., 17" = LE, 19" = XSE)

## When Ready, Run:

### 1. Prepare batches
```bash
node scripts/tire-validation/prepare-batches.mjs
```

### 2. Spawn agents (Clawd will do this)
Task template for each batch:
```
**TIRE SIZE + TRIM VALIDATION - Batch XX**

Process `scripts/tire-validation/batches/batch-XX.json`

FOR EACH VEHICLE:
1. `web_search` "{year} {make} {model} OEM tire size by trim level"
2. Extract:
   - Tire sizes per trim (e.g., LE: 215/55R17, XSE: 235/40R19)
   - Wheel sizes per trim (e.g., Base: 17x7, Sport: 19x8)
   - Staggered setups (front/rear differences)
3. Compare to `currentTireSizes` in batch file
4. Wait 2 sec between searches

OUTPUT: `scripts/tire-validation/results/batch-XX-results.json`

Format:
{
  "results": [{
    "year": 2024,
    "make": "toyota",
    "model": "camry",
    "trims": [
      {
        "trim": "LE",
        "wheelSize": {"diameter": 17, "width": 7.5, "offset": 40},
        "tireSize": "215/55R17"
      },
      {
        "trim": "XSE",
        "wheelSize": {"diameter": 19, "width": 8, "offset": 45},
        "tireSize": "235/40R19"
      },
      {
        "trim": "TRD",
        "wheelSize": {"diameter": 19, "width": 8.5, "offset": 35},
        "tireSize": "235/40R19",
        "notes": "TRD-specific wheels"
      }
    ],
    "isStaggered": false,
    "validation": {
      "matchesCurrent": true|false,
      "currentTireSizes": [...],
      "discrepancies": []
    },
    "source": "toyota.com, tirewheelguide.com",
    "confidence": "high"
  }]
}
```

### 3. Schema update needed
Before import, add trim support:
```sql
-- Option A: Add trim column to vehicle_fitments
ALTER TABLE vehicle_fitments ADD COLUMN IF NOT EXISTS trim VARCHAR(100);

-- Option B: Create trim-specific wheel/tire mapping table
CREATE TABLE IF NOT EXISTS trim_fitments (
  id SERIAL PRIMARY KEY,
  fitment_id INTEGER REFERENCES vehicle_fitments(id),
  trim VARCHAR(100),
  wheel_diameter INTEGER,
  wheel_width DECIMAL(3,1),
  wheel_offset INTEGER,
  tire_size VARCHAR(50),
  is_staggered BOOLEAN DEFAULT false,
  front_tire_size VARCHAR(50),
  rear_tire_size VARCHAR(50)
);
```

### 4. Import results
```bash
node scripts/tire-validation/import-results.mjs --dry-run  # Preview
node scripts/tire-validation/import-results.mjs           # Apply
```

## Priority Vehicles for Trim Research
- **Sports cars**: Mustang, Camaro, Challenger, Corvette, 370Z/400Z
- **Performance sedans**: M3/M5, RS3/RS5, AMG models
- **Popular with trim differences**: Camry, Accord, F-150, Silverado
- **SUVs with sport trims**: Explorer ST, Durango SRT, Grand Cherokee Trackhawk

## Expected Timeline
- Wheel research: ~65 batches, ~1 hour ✅ (in progress)
- Tire + trim validation: ~same batches, ~1-2 hours
- Total: ~3 hours for complete data overhaul with trim support
