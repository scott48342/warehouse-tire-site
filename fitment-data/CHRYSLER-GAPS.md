# Chrysler Fitment Gap Fill - Research Document

## Current Coverage (in production)
- 300 (2005-2026) - 22 years, mostly "Base" trims
- 300C (2005-2026) - 22 years, mostly "Base" trims

## Missing Models to Add (2000-current)

| Model | Year Range | Priority | Notes |
|-------|------------|----------|-------|
| Pacifica | 2004-2008, 2017-2026 | HIGH | Popular minivan, two generations |
| Town & Country | 2000-2016 | HIGH | Popular minivan, discontinued |
| Voyager | 2000-2003, 2020-2026 | MEDIUM | Budget minivan |
| 200 | 2011-2017 | HIGH | Mid-size sedan, replaced Sebring |
| Sebring | 2000-2010 | MEDIUM | Mid-size sedan/convertible |
| PT Cruiser | 2001-2010 | MEDIUM | Compact, distinctive styling |
| Crossfire | 2004-2008 | LOW | Sports car, low volume |
| Aspen | 2007-2009 | LOW | SUV, short production |
| Concorde | 2000-2004 | LOW | Full-size sedan, discontinued |
| LHS | 2000-2001 | LOW | Luxury sedan, discontinued |

## Research Required Per Model

For each model/year, we need:
1. **Submodels/Trims** (e.g., Touring, Limited, LX, etc.)
2. **Bolt Pattern** (e.g., 5x115, 5x127)
3. **Center Bore** (e.g., 71.5mm)
4. **Thread Size** (e.g., M12x1.5)
5. **OEM Wheel Sizes** (e.g., 17x7, 18x7.5)
6. **OEM Tire Sizes** (e.g., 225/65R17, 235/55R18)

## Verified Fitment Data

### Chrysler Pacifica (2017-2026, 3rd Gen)
**Source:** [TO BE RESEARCHED]
- Bolt Pattern: 5x127 (5x5")
- Center Bore: 71.5mm
- Thread Size: M14x1.5
- Trims: Touring, Touring L, Limited, Pinnacle, Hybrid
- OEM Wheels: 17", 18", 20"
- OEM Tires: TBD

### Chrysler Pacifica (2004-2008, 1st Gen)
**Source:** [TO BE RESEARCHED]
- Bolt Pattern: 5x127 (5x5")
- Center Bore: 71.5mm
- Thread Size: M12x1.5
- Trims: Base, Touring, Limited
- OEM Wheels: 17", 19"
- OEM Tires: TBD

### Chrysler Town & Country (2008-2016, 5th Gen)
**Source:** [TO BE RESEARCHED]
- Bolt Pattern: 5x127 (5x5")
- Center Bore: 71.5mm
- Thread Size: M12x1.5
- Trims: LX, Touring, Touring L, Limited
- OEM Wheels: 16", 17"
- OEM Tires: TBD

### Chrysler Town & Country (2001-2007, 4th Gen)
**Source:** [TO BE RESEARCHED]
- Bolt Pattern: 5x114.3 (5x4.5")
- Center Bore: 71.5mm
- Thread Size: M12x1.5
- Trims: LX, LXi, Limited, Touring
- OEM Wheels: 15", 16", 17"
- OEM Tires: TBD

### Chrysler 200 (2011-2017)
**Source:** [TO BE RESEARCHED]
- Bolt Pattern: 5x110 (2011-2014), 5x114.3 (2015-2017)
- Center Bore: 65.1mm (2011-2014), 67.1mm (2015-2017)
- Thread Size: M12x1.5
- Trims: LX, Touring, Limited, S, C
- OEM Wheels: 17", 18", 19"
- OEM Tires: TBD

### Chrysler Sebring (2007-2010, 3rd Gen)
**Source:** [TO BE RESEARCHED]
- Bolt Pattern: 5x114.3
- Center Bore: 67.1mm
- Thread Size: M12x1.5
- Trims: LX, Touring, Limited
- OEM Wheels: 16", 17", 18"
- OEM Tires: TBD

### Chrysler PT Cruiser (2001-2010)
**Source:** [TO BE RESEARCHED]
- Bolt Pattern: 5x100
- Center Bore: 57.1mm
- Thread Size: M12x1.5
- Trims: Base, Touring, Limited, GT
- OEM Wheels: 15", 16", 17"
- OEM Tires: TBD

## Data Sources to Check
1. Chrysler official specs (owner's manuals)
2. tirerack.com (verified OEM sizes)
3. discounttire.com
4. OEM parts catalogs
5. TPMS sensor databases (have exact specs)

## Import Format
Once verified, data should be formatted as:
```json
{
  "year": 2023,
  "make": "Chrysler",
  "model": "Pacifica",
  "displayTrim": "Touring L",
  "boltPattern": "5x127",
  "centerBore": "71.5",
  "threadSize": "M14x1.5",
  "oemWheelSizes": ["18x7.5"],
  "oemTireSizes": ["235/60R18"]
}
```

## Status
- [ ] Pacifica (2017-2026) - Research needed
- [ ] Pacifica (2004-2008) - Research needed
- [ ] Town & Country (2008-2016) - Research needed
- [ ] Town & Country (2001-2007) - Research needed
- [ ] 200 (2011-2017) - Research needed
- [ ] Sebring (2007-2010) - Research needed
- [ ] PT Cruiser (2001-2010) - Research needed
- [ ] Voyager (2020-2026) - Research needed
