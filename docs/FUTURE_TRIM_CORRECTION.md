# FUTURE_TRIM Correction Methodology

## Problem Description

**FUTURE_TRIM contamination** occurs when trim names from newer generations are incorrectly applied to older model years. This typically happens during data import when generation-based trim data is inherited across all years without validation.

**Example:** A 2010 Lexus LX incorrectly having "F Sport" or "LX 600" trims (which didn't exist until 2022).

## Root Cause

67% of mismatches came from `generation_inherit` source in our data pipeline, where trim names from the latest generation were retroactively applied to all years.

## Correction Framework

### Step 1: Define FutureTrimConfig

```typescript
interface FutureTrimConfig {
  make: string;
  model: string;
  futureTrims: string[];    // Trims that are "future" (didn't exist in older years)
  firstValidYear: number;   // Year when future trims became valid
  generations: GenerationSpec[];
}

interface GenerationSpec {
  yearStart: number;
  yearEnd: number;
  validTrims: string[];     // Trims that actually existed in this generation
  correctTrim: string;      // What to rename invalid trims to
  specs: {
    bolt_pattern: string;
    center_bore_mm: number;
    oem_wheel_sizes: any[];
    oem_tire_sizes: string[];
  };
}
```

### Step 2: Configure by Vehicle

Example for Lexus LX:

```typescript
const LEXUS_LX_CONFIG: FutureTrimConfig = {
  make: 'Lexus',
  model: 'lx',
  futureTrims: ['LX 600', 'F Sport', 'Ultra Luxury'],
  firstValidYear: 2022,
  generations: [
    {
      yearStart: 1996,
      yearEnd: 1997,
      validTrims: ['LX 450', 'Base'],
      correctTrim: 'LX 450',
      specs: {
        bolt_pattern: '5x150',
        center_bore_mm: 108,
        oem_wheel_sizes: [...],
        oem_tire_sizes: ['275/70R16']
      }
    },
    {
      yearStart: 1998,
      yearEnd: 2007,
      validTrims: ['LX 470', 'Base'],
      correctTrim: 'LX 470',
      specs: { ... }
    },
    {
      yearStart: 2008,
      yearEnd: 2021,
      validTrims: ['LX 570', 'Base'],
      correctTrim: 'LX 570',
      specs: { ... }
    }
  ]
};
```

### Step 3: Apply Correction Logic

1. Find all `needs_review` records with `FUTURE_TRIM` errors
2. For each record:
   - Find appropriate generation based on year
   - Check if trim needs correction (is it a future trim?)
   - Rename trim to generation's correct trim
   - Apply correct OEM specs for that generation
   - Preserve original data in `audit_original_data`
   - Set `certification_status = 'certified'`

### Step 4: Verify Results

- Check all records are now certified
- Verify trims match valid options for each generation
- Confirm OEM specs are correct for each generation

## Applicable Models

| Make | Model | Future Trims | First Valid Year |
|------|-------|--------------|------------------|
| Lexus | LX | LX 600, F Sport, Ultra Luxury | 2022 |
| Cadillac | Escalade | Escalade-V, Sport Platinum | 2022-2023 |
| GMC | Yukon | Denali Ultimate, AT4 | 2021-2022 |
| Chevrolet | Tahoe | Z71, RST, High Country | varies |
| Ford | Explorer | Platinum, ST, Timberline | 2020-2022 |
| Ford | Ranger | Raptor | 2024 |
| Toyota | Tacoma | TRD Pro (modern), Trailhunter | varies |

## Script Template

See: `scripts/fix-future-trim-lexus-lx.ts`

This script provides a complete, reusable template that can be adapted for other models by:
1. Copying the script
2. Updating the config object with model-specific generations
3. Running with `--dry-run` first to verify
4. Running without flag to apply

## Audit Trail

All corrections preserve original data:
```json
{
  "audit_original_data": {
    "original_trim": "F Sport",
    "original_wheels": [...],
    "original_tires": [...],
    "captured_at": "2026-04-26T..."
  }
}
```

This allows rollback if needed and provides accountability for changes.

## Results Tracking

| Date | Model | Records Fixed | Certification % |
|------|-------|---------------|-----------------|
| 2026-04-26 | Lexus LX | 116 | 90.6% |
