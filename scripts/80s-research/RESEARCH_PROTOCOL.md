# 1980s Vehicle Fitment Research Protocol

## ⚠️ 80s DATA IS HARDER TO FIND

80s vehicles have less online documentation. Lean heavily on enthusiast forums and cross-reference carefully.

## Required Data Per Vehicle

```json
{
  "year": 1985,
  "make": "Chevrolet",
  "model": "Camaro",
  "bolt_pattern": "5x120.65",
  "hub_bore": 70.3,
  "oem_wheel_sizes": [
    { "diameter": 15, "width": 7, "offset": 0 }
  ],
  "oem_tire_sizes": ["215/65R15", "245/50R16"],
  "staggered": false,
  "sources": ["thirdgen.org", "nastyz28.com"],
  "confidence": "high",
  "notes": "IROC-Z has 16\" wheels"
}
```

## Approved Sources (Priority Order)

### Tier 1: Enthusiast Communities (BEST for 80s)
1. **nastyz28.com** - F-body (Camaro/Firebird)
2. **thirdgen.org** - Third-gen F-body
3. **pro-touring.com** - Classic muscle
4. **gmtruckclub.com** - GM trucks
5. **ford-trucks.com** - Ford trucks
6. **turbobricks.com** - Volvo (if needed)
7. **jeepforum.com** - Jeep
8. **allpar.com** - Mopar (Chrysler/Dodge/Plymouth)
9. **grandnationalowners.com** - Buick Grand National/Regal

### Tier 2: General Reference
10. **roadkillcustoms.com** - Good bolt pattern reference
11. **rimsizes.com** - Basic specs
12. **tirewheelguide.com** - Cross-reference
13. **hulkoffsets.com** - Offset data

### Tier 3: Last Resort
14. **wheeladapter.com** - Adapter fitment guides
15. **Wikipedia** - Platform/generation info only

## ❌ BANNED Sources
- **wheel-size.com** - DO NOT USE
- **simpletire.com** - DO NOT USE
- **tirerack.com** - DO NOT USE

## Common 80s Platforms (Know These!)

### GM
- **F-body** (1982-1992): Camaro, Firebird - 5x120.65
- **G-body** (1978-1988): Monte Carlo, Grand Prix, Cutlass, Regal, El Camino - 5x120.65
- **B-body** (1977-1990): Caprice, Impala, Parisienne - 5x127
- **A-body** (1982-1996): Celebrity, Century, Ciera, 6000 - 5x115
- **J-body** (1982-1994): Cavalier, Sunbird, Firenza, Skyhawk, Cimarron - 5x100
- **C/K Truck** (1973-1987): C10/K10, C20/K20 - 5x127 (half ton), 8x165.1 (3/4+ ton)
- **S-truck** (1982-1993): S10, S15, Blazer, Jimmy - 5x120.65 (2WD), 6x139.7 (4WD early)

### Ford
- **Fox body** (1979-1993): Mustang, Thunderbird, Cougar, LTD - 4x108 (4-cyl), 5x114.3 (V8)
- **Panther** (1979-2011): Crown Vic, Grand Marquis, Town Car - 5x114.3
- **F-Series** (1980-1986): F-150/250/350 - 5x139.7 (150), 8x165.1 (250/350)
- **Bronco/Ranger**: Various patterns by year

### Chrysler/Dodge
- **M-body** (1977-1989): Diplomat, Gran Fury, Fifth Avenue - 5x114.3
- **K-car** (1981-1989): Reliant, Aries, LeBaron, New Yorker - 4x100 or 5x100
- **G-body vans** (1984+): Caravan, Voyager - 5x100

### Jeep
- **CJ** (1976-1986): CJ-5, CJ-7 - 5x139.7
- **YJ** (1987-1995): Wrangler - 5x114.3
- **XJ** (1984-2001): Cherokee - 5x114.3
- **SJ** (1963-1991): Grand Wagoneer, J-truck - 5x139.7

## Verification Rules

1. **2+ sources must agree** on bolt pattern
2. Hub bore within 1mm variance OK
3. Flag any mid-generation changes
4. Note trim-specific differences (IROC vs base Camaro, etc.)

## Output Format

Save to: `scripts/80s-research/results/batch-XX-results.json`

```json
{
  "batchId": "80s-batch-XX",
  "completedAt": "...",
  "results": [...],
  "researchNotes": "..."
}
```
