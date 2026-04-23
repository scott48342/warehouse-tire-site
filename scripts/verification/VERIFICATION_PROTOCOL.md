# Fitment Verification Protocol

## Purpose
Re-verify all web_research records that were imported without proper validation.

## BANNED Sources (Legal Risk)
- wheel-size.com
- simpletire.com
- tirerack.com
- discounttire.com

## Approved Sources (Priority Order)
1. **Manufacturer websites** (toyota.com, honda.com, bmwusa.com, etc.)
2. **Dealer spec pages** (dealer sites with OEM specs)
3. **tiresize.com** - Cross-reference only
4. **tirewheelguide.com** - Bolt patterns, hub bores
5. **Car and Driver, Motor Trend, Edmunds** - Spec sheets
6. **Model-specific forums** (verified specs from enthusiast communities)

## Verification Requirements

### MUST Verify (not copy from existing data):
1. **Bolt pattern** - Confirm from 2+ sources
2. **Hub bore** - Confirm from manufacturer or quality source
3. **OEM tire sizes** - Must match specific trim levels
4. **OEM wheel sizes** - Width, diameter, offset when available

### Red Flags to Watch For:
- Tire sizes that don't match wheel diameters
- Truck tire sizes (285/75R16, 265/70R17) on sedans/compacts
- More than 4-5 tire size options (likely garbage data)
- Hub bores outside normal ranges (50-130mm for most vehicles)

## Output Format
```json
{
  "year": 2024,
  "make": "Toyota",
  "model": "Camry",
  "boltPattern": "5x114.3",
  "hubBore": 60.1,
  "trims": [
    {
      "name": "LE",
      "oemWheelSize": "17x7",
      "oemTireSize": "215/55R17"
    },
    {
      "name": "XSE",
      "oemWheelSize": "19x8",
      "oemTireSize": "235/40R19"
    }
  ],
  "confidence": "high",
  "sources": ["toyota.com", "edmunds.com"],
  "notes": "Any special notes"
}
```

## Confidence Levels
- **high**: Verified from manufacturer + 1 other source
- **medium**: Verified from 2 non-manufacturer sources
- **low**: Single source only (flag for manual review)

## Batch Processing
Each batch should contain ~50-100 vehicles grouped by:
- Make (Toyota, Honda, etc.)
- Era (2000s, 2010s, 2020s)
- Type (sedan, SUV, truck)
