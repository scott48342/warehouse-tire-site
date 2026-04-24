# Trim-Level Fitment Research Protocol

## Objective
Research and verify trim-specific wheel and tire data for every vehicle. No guessing, no assumptions.

## Required Data Per Trim

For each Year/Make/Model/Trim combination, collect:

1. **Trim Name** - Exact trim designation (e.g., "LX", "Sport", "Touring", "RS Package")
2. **OEM Wheel Sizes** - Diameter and width (e.g., "17x7", "19x8.5")
3. **OEM Tire Sizes** - Full size string (e.g., "225/50R17", "245/40R19")
4. **Source** - Where this data came from

## Approved Sources (Priority Order)

1. **Manufacturer Specs** - edmunds.com/[make]/[model]/[year]/features-specs
2. **Car and Driver** - caranddriver.com specs pages
3. **MotorTrend** - motortrend.com specs pages  
4. **Tire Rack** - OEM tire size data (tirerack.com)
5. **Official Window Stickers** - If available

## Data Format

For each vehicle, create a JSON entry:

```json
{
  "year": 2024,
  "make": "Honda",
  "model": "Accord",
  "trims": [
    {
      "name": "LX",
      "wheelSizes": [{"diameter": 17, "width": 7}],
      "tireSizes": ["215/55R17"],
      "source": "edmunds.com"
    },
    {
      "name": "Sport",
      "wheelSizes": [{"diameter": 18, "width": 8}],
      "tireSizes": ["235/45R18"],
      "source": "edmunds.com"
    },
    {
      "name": "Sport Special Edition",
      "wheelSizes": [{"diameter": 19, "width": 8.5}],
      "tireSizes": ["235/40R19"],
      "source": "edmunds.com"
    },
    {
      "name": "EX-L",
      "wheelSizes": [{"diameter": 17, "width": 7}, {"diameter": 18, "width": 8}],
      "tireSizes": ["215/55R17", "235/45R18"],
      "source": "edmunds.com"
    },
    {
      "name": "Touring",
      "wheelSizes": [{"diameter": 19, "width": 8.5}],
      "tireSizes": ["235/40R19"],
      "source": "edmunds.com"
    }
  ],
  "notes": "EX-L has optional 18-inch wheel upgrade",
  "verified": true
}
```

## Rules

1. **NO GUESSING** - If data isn't available, mark as "needs_verification"
2. **NO COPYING** - Don't copy tire sizes from one trim to another
3. **VERIFY EACH TRIM** - Even if trims look similar, verify separately
4. **INCLUDE ALL OPTIONS** - If a trim has optional wheel packages, include both
5. **STAGGERED SETUPS** - Note front/rear differences for performance vehicles

## Output Location

Save completed research to:
`scripts/trim-research/completed/[Make]/[Model].json`

## Batch Assignment

- Work through vehicles in the assigned queue file
- Process ~50 vehicles per batch
- Update database after each batch is verified
