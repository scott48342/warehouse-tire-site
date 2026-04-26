# Trim-Level Fitment Research Instructions

## Overview
This document describes how to properly research and update vehicle fitment data with **trim-specific** wheel and tire sizes.

## The Search Query
For each make+model combination, search Google for:
```
{Make} {Model} OEM wheel specs and tire sizes by submodel
```

Example: `Toyota Highlander OEM wheel specs and tire sizes by submodel`

## What the AI Overview Returns
Google's AI Overview will return generation-by-generation, trim-by-trim data like:

```
Toyota Highlander (2020–2026, 4th Gen):
- Bolt Pattern: 5x114.3mm
- Center Bore: 60.1mm
- Lug Nut: M12x1.5

LE / XLE:
  Tires: 235/65R18
  Wheels: 18" x 8"J, ET35

Limited / Platinum / XSE:
  Tires: 235/55R20
  Wheels: 20" x 8"J, ET30-35

Gen 3 (2017–2019):
  LE/XLE: 245/60R18, 7.5Jx18
  SE/Limited: 245/55R19, 7.5Jx19
```

## Data to Extract
For each model, extract:

### Model-Level (same for all trims):
- **Bolt Pattern** (e.g., "5x114.3")
- **Center Bore** (e.g., 60.1mm)
- **Thread/Lug Size** (e.g., "M12x1.5")

### Trim-Level (different per trim):
- **Year Range** (e.g., 2020-2026)
- **Trim Names** (e.g., "LE", "XLE", "Limited")
- **Wheel Diameter** (e.g., 18" or 20")
- **Wheel Width** (e.g., 8J)
- **Wheel Offset** (e.g., ET35)
- **Tire Size** (e.g., "235/65R18")

## Database Fields to Update
```sql
UPDATE vehicle_fitments SET
  bolt_pattern = '5x114.3',
  center_bore_mm = 60.1,
  thread_size = 'M12x1.5',
  oem_wheel_sizes = '[{"diameter": 18, "width": 8, "offset": 35, "axle": "square", "isStock": true}]',
  oem_tire_sizes = '["235/65R18"]',
  source = 'trim-research',
  quality_tier = 'complete'
WHERE id = ?
```

## Matching Logic
1. Match record's `year` to generation year range
2. Match record's `display_trim` to trim names from AI Overview
3. Apply the wheel/tire specs for that specific trim

## Handling Edge Cases

### Staggered Setups (Performance Cars)
For cars like BMW M4, Mustang GT, etc.:
```json
{
  "wheels": [
    {"diameter": 19, "width": 9.5, "offset": 20, "axle": "front"},
    {"diameter": 20, "width": 10.5, "offset": 20, "axle": "rear"}
  ],
  "tires": ["275/35R19", "285/30R20"]
}
```

### Trim Not Found in AI Overview
If a database trim doesn't match any AI Overview trim:
1. Flag it for manual review
2. Don't guess or apply generic data
3. Skip updating that record

### Multiple Wheel Options Per Trim
Some trims offer multiple wheel sizes (e.g., XLE can have 18" or 20"):
- Store the **base/standard** option
- Higher trims typically have larger wheels

## Batch Processing
Models are batched by make. Each sub-agent processes one make at a time:

1. Load models from `research-list.json`
2. Filter by make (e.g., `--make=Toyota`)
3. For each model:
   - Search Google
   - Extract AI Overview
   - Parse into structured data
   - Update database records
4. Report results

## Scripts
- `scripts/research-list.json` - List of 205 make+model combinations
- `scripts/trim-research-batch.ts` - Batch processor with parsing logic
- `scripts/trim-fitment-research.ts` - Single model test script

## Quality Checks
After processing, verify:
1. No records still have `source = 'google-ai-overview'` (all should be `trim-research`)
2. Wheel sizes vary by trim (not all same)
3. Staggered vehicles have front/rear axle specs
