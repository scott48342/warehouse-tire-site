# Toyota Trim Research Summary

**Date**: 2026-04-24
**Researcher**: Clawdbot Subagent
**Source Priority**: caranddriver.com, edmunds.com

## Models Researched

| Model | Trims Verified | Status |
|-------|---------------|--------|
| Camry | LE, SE, XSE, Nightshade | ✅ Mostly Verified |
| Corolla | L, LE | ⚠️ Partial (SE/XSE need verification) |
| RAV4 | LE, XLE | ⚠️ Partial |
| RAV4 Hybrid | SE | ⚠️ Partial |
| Tacoma | SR, SR5 | ⚠️ Partial |
| Tundra | SR | ⚠️ Partial |
| 4Runner | SR5 | ⚠️ Partial |
| Highlander | XLE | ⚠️ Partial |
| Sienna | LE | ⚠️ Partial |
| Prius | LE, XLE | ⚠️ Partial |

## Key Findings

### Camry (2025+)
- **Hybrid-only** starting 2025 model year
- LE: 16" wheels, 205/65R16 tires
- SE: 18" wheels, 235/45R18 tires
- XSE: 19" wheels, 235/40R19 tires

### Corolla (2025-2026)
- L: 16" steel with covers, 205/55R16

### RAV4 / RAV4 Hybrid (2025-2026)
- LE (gas): 17" steel, 225/65R17
- SE (hybrid): 17" alloy, 235/65R17

### Tacoma (2025-2026 - 4th Gen)
- SR: 17" steel, 245/70R17
- Note: 2.4L turbo 4-cyl engine

### Tundra (2025)
- SR: 18" steel, 245/75R18
- Note: 3.4L V6 twin-turbo

### 4Runner (2025 - 6th Gen)
- SR5: 17" alloy, 245/70R17
- Note: 2.4L turbo 4-cyl, also hybrid available

### Highlander (2025)
- XLE: 18" alloy, 235/65R18
- Note: 2.4L turbo 4-cyl

### Sienna (2025 - Hybrid Only)
- LE: 17" alloy, 235/65R17

### Prius (2025 - 5th Gen)
- LE/XLE: 17" alloy, 195/60R17
- Limited: 19" wheels, 195/50R19

## Sources Used

1. **caranddriver.com** - Primary source for spec pages
2. **edmunds.com** - Secondary verification (browser required due to blocking)
3. **motortrend.com** - Limited data (some pages 404)
4. **kbb.com** - Pricing context

## Limitations

1. **Edmunds blocked web_fetch** - Required browser automation
2. **Car and Driver** shows default/base trims only - higher trims need separate verification
3. **Trim-specific specs** vary by package options

## Recommendations

1. Use browser automation for Edmunds to get full trim dropdown data
2. Cross-reference with official Toyota configurator for 2025-2026 models
3. Mark all "needs_verification" trims before importing to production database
