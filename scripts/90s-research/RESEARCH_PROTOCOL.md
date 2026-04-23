# 1990s Vehicle Fitment Research Protocol

## ⚠️ ACCURACY IS CRITICAL

90s vehicles have inconsistent online data. Every spec must be **verified from 2+ sources**.

## Required Data Per Vehicle

```json
{
  "year": 1995,
  "make": "Honda",
  "model": "Civic",
  "bolt_pattern": "4x100",
  "hub_bore": 56.1,
  "oem_wheel_sizes": [
    { "diameter": 14, "width": 5.5, "offset": 45 }
  ],
  "oem_tire_sizes": ["185/65R14", "195/60R14"],
  "staggered": false,
  "sources": ["willtheyfit.com", "wheel-size.com archive"],
  "confidence": "high",
  "notes": "Base model specs. Si has 15\" wheels."
}
```

## Approved Sources (Priority Order)

### Tier 1: Most Reliable
1. **OEM Service Manuals** (if accessible)
2. **willtheyfit.com** - Good 90s coverage, includes hub bore
3. **rimsizes.com** - Solid bolt pattern data
4. **boltpattern.net** - Basic specs, verify elsewhere

### Tier 2: Cross-Reference
5. **Enthusiast Forums** (honda-tech, toyotanation, etc.) - Use for verification
6. **Wikipedia vehicle articles** - Often list wheel specs
7. **Parts store fitment guides** (TireRack archive, if available)

### Tier 3: Last Resort
8. **General search** - Only if Tier 1-2 fail, require 3+ matching sources

## ❌ BANNED Sources
- **wheel-size.com** (legal risk - DO NOT SCRAPE)
- **simpletire.com** (legal risk)
- **tirerack.com** (legal risk)
- Random tire/wheel retailer product pages

## Verification Rules

1. **Bolt Pattern**: Must match across 2+ sources
2. **Hub Bore**: Must be within 0.5mm across sources (common variance)
3. **Wheel Diameter**: Must match exactly
4. **Wheel Width**: Must be within 0.5" across sources
5. **Offset**: Must be within 5mm across sources (most variance here)
6. **Tire Size**: Must match at least 1 source exactly

## Confidence Ratings

- **HIGH**: 2+ Tier 1 sources agree, all fields complete
- **MEDIUM**: 1 Tier 1 + 1 Tier 2 source, or 3+ Tier 2 sources
- **LOW**: Single source or significant variance - FLAG FOR REVIEW

## Common 90s Gotchas

### Mid-Generation Changes
- **Honda Civic**: 4x100 throughout 90s, but wheel sizes changed 92→96
- **Ford Ranger**: 5x114.3 (4.5") standard, but some 4x4s had different
- **Chevy S-10**: 5x120.65 (4.75") for most, but ZR2 had different offset

### Trim Differences
- Base vs Sport trims often have different wheel sizes
- Document the BASE trim first, note trim differences in `notes` field

### Regional Variants
- JDM specs may differ from USDM - always verify US market
- Canadian models usually match US specs

## Output Format

Save results to: `scripts/90s-research/results/batch-XX-results.json`

```json
{
  "batchId": "90s-batch-01",
  "completedAt": "2026-04-22T...",
  "results": [
    {
      "year": 1995,
      "make": "Honda", 
      "model": "Civic",
      "status": "complete",
      "data": { ... },
      "confidence": "high",
      "sources": ["willtheyfit.com", "honda-tech.com"],
      "verifiedBy": "cross-reference"
    }
  ],
  "summary": {
    "total": 75,
    "complete": 70,
    "partial": 3,
    "failed": 2,
    "highConfidence": 65,
    "needsReview": 5
  }
}
```

## Quality Checklist (Before Submitting)

- [ ] All bolt patterns are valid format (e.g., "5x114.3" not "5x4.5")
- [ ] Hub bores are in mm (e.g., 67.1 not 2.64)
- [ ] Wheel widths are reasonable (5-10" for 90s vehicles)
- [ ] Offsets are reasonable (typically +15 to +55mm for 90s)
- [ ] No copy-paste errors from adjacent years
- [ ] Staggered flag only set for TRUE staggered setups (different front/rear)

## Red Flags - Stop and Verify

- Hub bore > 110mm or < 50mm → Probably wrong
- Offset > +60mm or < 0mm → Unusual, verify
- Wheel width > 10" on a 90s economy car → Wrong
- Bolt pattern doesn't match make's typical pattern → Verify year range
