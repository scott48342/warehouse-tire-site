# Hyundai & Kia Trim Research Summary

**Research Date:** 2026-04-24
**Researcher:** Subagent (trim-research-hyundai-kia)

## Research Methodology

- **Primary Source:** caranddriver.com specs pages (base trim specs)
- **Secondary Source:** motortrend.com (general info, XRT/X-Pro trims)
- **Blocked Source:** edmunds.com (403 Access Denied)
- **No web_search:** Brave API key not configured

## Data Quality Note

⚠️ **PARTIAL DATA** - Due to source limitations:
- Only BASE TRIM specs are fully verified from Car & Driver
- Higher trims (SEL, Limited, N Line, etc.) are ESTIMATED based on typical progressions
- Each JSON file has `verified: true/false` flags per trim

## Files Created

### Hyundai (7 vehicles)
| Model | Base Trim Verified | Verified Wheel/Tire |
|-------|-------------------|---------------------|
| Elantra | SE ✅ | 15" / 195/65R15 |
| Kona | SE ✅ | 17" / 215/60R17 |
| Palisade | SE ✅ | 18" / 235/65R18 |
| Santa Cruz | SE ✅ | 18" / 245/60R18 |
| Santa Fe | SE ✅ | 18" / 235/60R18 |
| Sonata | SE ✅ | 16" / 205/65R16 |
| Tucson | SE ✅ | 17" / 235/65R17 |

### Kia (7 vehicles)
| Model | Base Trim Verified | Verified Wheel/Tire |
|-------|-------------------|---------------------|
| Carnival | LX ✅ | 17" / 235/65R17 |
| Forte | FE ✅ | 15" / 195/65R15 |
| K5 | LX ✅ | 16" / 205/65R16 |
| Seltos | LX ✅ | 17" / 215/55R17 |
| Sorento | LX ✅ | 17" / 235/65R17 |
| Sportage | LX ✅ | 17" / 235/65R17 |
| Telluride | LX ✅ | 18" / 235/65R18 |

## Next Steps Required

1. **Verify higher trims** - Need manufacturer specs or access to Edmunds
2. **Configure Brave API** - Run `clawdbot configure --section web` to enable web_search
3. **Consider browser automation** - Hyundai/Kia official sites have full trim comparisons
4. **Cross-reference with existing DB** - Compare against current vehicle_fitments table

## Typical Wheel Progression Patterns

For reference, these patterns were used for estimates:
- **Sedans:** 15" → 16" → 17" → 18" (base → sport/limited)
- **Compact SUVs:** 17" → 18" → 19" (base → limited/N Line)
- **Mid-size SUVs:** 18" → 19" → 20" (base → limited/calligraphy)
- **3-Row SUVs:** 18" → 20" (base → SX/Limited)
- **Performance trims:** +1-2" vs comparable non-sport trim

## Files Location
```
completed/
├── Hyundai/
│   ├── Elantra.json
│   ├── Kona.json
│   ├── Palisade.json
│   ├── Santa-Cruz.json
│   ├── Santa-Fe.json
│   ├── Sonata.json
│   └── Tucson.json
└── Kia/
    ├── Carnival.json
    ├── Forte.json
    ├── K5.json
    ├── Seltos.json
    ├── Sorento.json
    ├── Sportage.json
    └── Telluride.json
```
