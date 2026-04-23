# Muscle Car Fitment Research Protocol (1964-1979)

## ⚠️ VERIFICATION MODE

This research serves TWO purposes:
1. **Fill gaps** in missing muscle car coverage
2. **Verify existing data** - we've found errors in other eras

If you find data that conflicts with what might already exist in the DB, note it clearly. Better data wins.

## Required Data Per Vehicle

```json
{
  "year": 1970,
  "make": "Plymouth",
  "model": "Road Runner",
  "bolt_pattern": "5x114.3",
  "hub_bore": 71.5,
  "oem_wheel_sizes": [
    { "diameter": 14, "width": 6, "offset": 0 },
    { "diameter": 15, "width": 7, "offset": 0 }
  ],
  "oem_tire_sizes": ["F70-14", "G70-14", "F60-15"],
  "staggered": false,
  "sources": ["forabodiesonly.com", "moparts.com"],
  "confidence": "high",
  "notes": "383/440 cars. Hemi cars had different options."
}
```

## Approved Sources (Priority Order)

### Tier 1: Marque-Specific Forums (BEST)
**GM:**
- nastyz28.com, thirdgen.org (F-body)
- chevelles.com, chevellestuff.net (A-body)
- corvetteforum.com (Corvette)
- pro-touring.com (general GM muscle)

**Ford:**
- vintagemusclecars.com
- mustangforums.com, vintage-mustang.com
- fourdoorfordforum.com
- fordmuscle.com

**Mopar:**
- forabodiesonly.com (B-body - THE source)
- forbbodiesonly.com (B-body)
- moparts.com
- 440source.com
- challengertalk.com (E-body)
- valiant.org (A-body)

**AMC:**
- theamcforum.com
- javelin-amx.com

### Tier 2: General Reference
- roadkillcustoms.com
- rimsizes.com
- tirewheelguide.com
- wikipedia.org (platform/generation info)

## ❌ BANNED Sources
- **wheel-size.com** - DO NOT USE
- **simpletire.com** - DO NOT USE
- **tirerack.com** - DO NOT USE

## Key Platform Knowledge

### GM A-body (1964-1977)
**Chevelle, Malibu, El Camino, GTO, LeMans, Skylark, Cutlass, 442**
- 1964-1967: **5x120.65** (5x4.75") - Small bolt pattern
- 1968-1972: **5x120.65** still, hub bore 70.3mm
- 1973-1977: **5x120.65** continues

### GM F-body (1967-1981)
**Camaro, Firebird**
- 1st gen (1967-1969): **5x120.65**, 70.3mm hub
- 2nd gen (1970-1981): **5x120.65**, 70.3mm hub

### GM B-body (1965-1976)
**Impala, Caprice, Bel Air**
- All years: **5x127** (5x5")
- Hub bore: 78.1mm

### Ford Mustang (1964.5-1973)
- 1964.5-1973: **5x114.3** (5x4.5")
- Hub bore: 70.5mm (early), 70.6mm (later)

### Ford Intermediate (Torino, Fairlane)
- 1966-1971: **5x114.3**
- Hub bore: 70.5mm

### Mopar E-body (1970-1974)
**Challenger, Barracuda/'Cuda**
- All years: **5x114.3** (5x4.5")
- Hub bore: 71.1mm

### Mopar B-body (1966-1971)
**Charger, Road Runner, GTX, Coronet, Super Bee, Satellite**
- All years: **5x114.3**
- Hub bore: 71.1mm

### Mopar A-body (1964-1976)
**Dart, Duster, Valiant, Demon**
- 1964-1972: **5x114.3**
- 1973-1976: **5x114.3**
- Hub bore: 71.1mm

### AMC (1968-1974)
**Javelin, AMX**
- All years: **5x114.3**
- Hub bore: 72mm

## Tire Size Notes

60s/70s tires used bias-ply sizing (F70-14, G60-15, etc.):
- First letter = load rating/width (E, F, G, H, etc.)
- Number = aspect ratio (70, 60, 50)
- Last number = wheel diameter

Convert to modern equivalents if helpful, but list original OEM sizes.

## Output Format

Save to: `scripts/muscle-research/results/batch-XX-results.json`

Use same JSON structure as other batches.
