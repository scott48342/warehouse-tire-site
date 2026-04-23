# Classic Show Car Fitment Research Protocol

## Scope
Pre-muscle era classics and show favorites (1953-1979)

## BANNED Sources (Legal Risk)
- wheel-size.com
- simpletire.com  
- tirerack.com
- discounttire.com

## Approved Sources (Priority Order)
1. **cokertire.com** - THE authority for classic/antique tire fitment
2. **diamondbackclassics.com** - Classic tire specialists
3. **tirewheelguide.com** - Bolt patterns, hub bores
4. **roadkillcustoms.com** - Classic bolt patterns
5. **Model-specific forums** (trifive.com, 67-72chevytrucks.com, etc.)
6. **hemmings.com** - Period specs and articles
7. **classicindustries.com** - OEM restoration parts
8. **tiresize.com** - Modern equivalent sizes

## Required Data Points
- Bolt pattern (metric mm)
- Hub bore (mm)
- OEM wheel width and diameter
- OEM tire size (original AND modern equivalent)
- Lug nut thread pitch
- Any year-over-year changes

## Platform Notes

### Tri-Five Chevy (1955-1957)
- All use 5x120.65 (5x4.75")
- Hub bore: 70.3mm
- CRITICAL: Different wheel backspacing for drum vs disc brake conversions

### Ford F-100 (1953-1979)
- Multiple generations with different patterns
- 1953-1956: 5x139.7 (5x5.5")
- 1957-1966: 5x139.7
- 1967-1972: 5x139.7 (Bumpside)
- 1973-1979: 5x139.7 (Dentside)

### Classic Cadillac
- Pre-1970: Various patterns
- Fins era (1957-1964): 5x127 (5x5")
- Watch for hub bore changes

## Output Format
Save as JSON with structure:
```json
{
  "batch": "batch-name",
  "platform": "platform-description", 
  "vehicles": [
    {
      "year": 1957,
      "make": "Chevrolet",
      "model": "Bel Air",
      "boltPattern": "5x120.65",
      "hubBore": 70.3,
      "oemWheelFront": "14x5",
      "oemTireFront": "205/75R14",
      "oemTireFrontOriginal": "7.10-15",
      "lugThread": "7/16-20",
      "notes": "Any special notes",
      "confidence": "high|medium|low",
      "sources": ["source1.com", "source2.com"]
    }
  ]
}
```
