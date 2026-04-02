# Trim Differentiation Plan for Fitment Accuracy

> **Created:** 2026-04-01
> **Purpose:** Identify models where trim selection affects wheel/tire fitment accuracy

## Executive Summary

87% of Y/M/M combinations in the database are single-trim "Base" entries. This is **correct** for most vehicles — economy cars and standard vehicles share identical fitment across trims. However, some models **require** trim differentiation for accurate fitment, particularly:

- Performance vehicles with staggered setups
- Models with significant wheel size variation between trims
- Vehicles with performance packages affecting brake clearance

This document identifies which models need true trim separation and prioritizes the work.

---

## Tier Classification

### 🔴 Tier A — HIGH PRIORITY (Must Fix)

These models have **significant fitment differences** between trims that affect:
- Wheel diameter (2"+ difference)
- Staggered vs non-staggered setups
- Width variations affecting fitment
- Safety-critical accuracy for performance vehicles

| Make | Model | Years | Why Trim Matters | Trims Needed |
|------|-------|-------|------------------|--------------|
| **Ford** | Mustang | 2015-2026 | Staggered on GT Performance/Shelby; 18" base vs 19-20" performance | EcoBoost, EcoBoost Performance, GT, GT Performance, Shelby GT350, Shelby GT500, Mach 1, Dark Horse |
| **Chevrolet** | Camaro | 2010-2024 | 18" base non-staggered vs 20" SS staggered vs ZL1 wider staggered | LS, LT, SS, ZL1, Z/28 |
| **Chevrolet** | Corvette | 2014-2026 | ALL trims staggered; Z06/ZR1/Z51 have different widths | Stingray, Z51, Grand Sport, Z06, ZR1 |
| **Dodge** | Challenger | 2015-2023 | 18" SXT vs 20" Scat Pack vs Widebody variants | SXT, R/T, Scat Pack, Scat Pack Widebody, Hellcat, Hellcat Widebody |
| **Dodge** | Charger | 2015-2023 | Same as Challenger — significant size/widebody differences | SXT, R/T, Scat Pack, Scat Pack Widebody, Hellcat, Hellcat Widebody |
| **Porsche** | 911 | 2012-2026 | EVERY trim has different staggered setup; GT3/GT2 RS vastly different | Carrera, Carrera S, Carrera 4S, GTS, Turbo, Turbo S, GT3, GT3 RS, GT2 RS |
| **Porsche** | Cayman/Boxster | 2012-2026 | Similar to 911 — different staggered setups per trim | Base, S, GTS, GT4 |
| **BMW** | M3/M4 | 2015-2026 | M3/M4 staggered vs standard 3/4-series non-staggered | Standard, Competition |
| **Subaru** | WRX | 2015-2026 | STI has 19" vs base 17"; different wheel specs | Base, Premium, Limited, STI |
| **Tesla** | Model 3 | 2017-2026 | Performance has 20" vs Standard 18-19" | Standard Range, Long Range, Performance |

**A-Tier Count: 10 vehicle lines (approximately 40-60 specific year/trim combinations)**

---

### 🟡 Tier B — MEDIUM PRIORITY

Moderate fitment variation; less common vehicles or minor differences.

| Make | Model | Years | Why Trim Matters | Notes |
|------|-------|-------|------------------|-------|
| **Ford** | F-150** | 2015-2026 | Raptor has unique wider fitment; FX4/Tremor different | Consider if Raptor popularity justifies |
| **Chevrolet** | Silverado/Sierra | 2019-2026 | Trail Boss/AT4 have different specs | Truck variants |
| **RAM** | 1500 | 2019-2026 | Already handled via rules (Classic vs DT) | ✅ Already differentiated |
| **Jeep** | Wrangler | 2018-2026 | Rubicon has larger wheels than Sport | Moderate difference |
| **Honda** | Civic Type R | 2017-2026 | Type R completely different from standard | Single performance variant |
| **Volkswagen** | Golf R/GTI | 2015-2026 | R/GTI different from base | Moderate sales volume |
| **Audi** | S/RS Models | Various | S/RS variants differ from standard | Complex line-up |
| **Mercedes-AMG** | C63, E63 | Various | AMG variants significantly different | Premium segment |
| **Nissan** | 370Z/Z | 2009-2026 | Nismo variants different | Sports car |
| **Mazda** | MX-5 Miata | 2015-2026 | Club/GT have different wheel options | Minor differences |

**B-Tier Count: ~10 vehicle lines (lower priority)**

---

### 🟢 Tier C — LOW PRIORITY (Safe as Single-Trim)

These models have **identical or near-identical fitment across all trims**. No action needed.

| Category | Examples |
|----------|----------|
| **Economy Cars** | Honda Civic (non-Type R), Toyota Corolla, Nissan Sentra, Hyundai Elantra |
| **Standard Sedans** | Toyota Camry, Honda Accord, Hyundai Sonata, Kia K5 |
| **Standard SUVs** | Toyota RAV4, Honda CR-V, Ford Escape, Chevy Equinox |
| **Trucks (non-performance)** | Ford F-150 (non-Raptor), Chevy Colorado, Toyota Tacoma (base) |
| **Minivans** | Honda Odyssey, Toyota Sienna, Chrysler Pacifica |
| **Older Vehicles** | Pre-2015 models (lower relevance for customers) |

---

## Tier A — Detailed Fitment Specifications

### Ford Mustang (2015-2026)

**S550 Platform (2015-2023) & S650 Platform (2024+)**

| Trim | Wheel Sizes | Staggered | Notes |
|------|-------------|-----------|-------|
| EcoBoost | 17"-19" | No | 235/50R18 typical |
| EcoBoost Performance | 19" | Yes | 255/40R19 F, 275/40R19 R |
| V6 (2015-2017) | 17"-18" | No | 235/50R18 |
| GT | 18"-20" | No | 255/45R18 or 255/40R19 |
| GT Performance Package | 19" | Yes | 255/40R19 F, 275/40R19 R |
| Shelby GT350 | 19" | Yes | 295/35R19 F, 305/35R19 R |
| Shelby GT500 (2020+) | 20" | Yes | 305/30R20 F, 315/30R20 R |
| Mach 1 | 19" | Yes | 305/30R19 F, 315/30R19 R |
| Dark Horse (2024+) | 19" | Yes | 255/40R19 F, 275/40R19 R or 305/30R19 F, 315/30R19 R (Handling Pkg) |

**Bolt Pattern:** 5x114.3 (all trims)
**Hub Bore:** 70.5mm
**Critical:** Performance Package and Shelby trims require staggered wheel orders

---

### Chevrolet Camaro (2010-2024)

**5th Gen (2010-2015) & 6th Gen (2016-2024)**

| Trim | Wheel Sizes | Staggered | Notes |
|------|-------------|-----------|-------|
| LS | 18" | No | 245/55R18 |
| LT | 18"-20" | Some | 245/55R18 or 245/50R19 |
| LT RS | 20" | Yes | 245/45R20 F, 275/40R20 R |
| SS | 20" | Yes | 245/45R20 F, 275/40R20 R |
| 1LE | 20" | Yes | Track-focused |
| ZL1 | 20" | Yes | 285/35R20 F, 305/35R20 R |
| Z/28 (2014-2015) | 19" | Yes | Track special |

**Bolt Pattern:** 5x120 (all trims)
**Hub Bore:** 66.9mm
**Critical:** SS and ZL1 require wider rear wheels; ZL1 has widest rear

---

### Dodge Challenger/Charger (2015-2023)

**LC Platform**

| Trim | Wheel Sizes | Staggered | Notes |
|------|-------------|-----------|-------|
| SXT | 18" | No | 235/55R18 |
| SXT AWD | 18" | No | 235/55R18 |
| R/T | 20" | No | 245/45R20 |
| Scat Pack | 20" | No | 245/45R20 or 275/40R20 |
| Scat Pack Widebody | 20" | Yes | 305/35R20 (wider fenders) |
| Hellcat | 20" | No | 275/40R20 |
| Hellcat Widebody | 20" | No | 305/35R20 |
| Demon/Super Stock | 20" | Special | Drag-specific |

**Bolt Pattern:** 5x115 (all trims)
**Hub Bore:** 71.5mm
**Critical:** Widebody trims require wider wheels; standard vs widebody is key differentiation

---

### Tesla Model 3 (2017-2026)

| Trim | Wheel Sizes | Staggered | Notes |
|------|-------------|-----------|-------|
| Standard Range | 18"-19" | No | 235/45R18 or 235/40R19 |
| Long Range | 18"-19" | No | 235/45R18 or 235/40R19 |
| Performance | 20" | No | 235/35R20 |

**Bolt Pattern:** 5x114.3
**Hub Bore:** 64.1mm
**Critical:** Performance has unique 20" wheel size

---

### Subaru WRX (2015-2026)

| Trim | Wheel Sizes | Staggered | Notes |
|------|-------------|-----------|-------|
| Base | 17" | No | 235/45R17 |
| Premium | 17"-18" | No | 235/45R17 or 245/40R18 |
| Limited | 18" | No | 245/40R18 |
| STI (2015-2021) | 18"-19" | No | 245/40R18 or 245/35R19 |
| TR/tS (2024+) | 19" | No | 245/35R19 |

**Bolt Pattern:** 5x114.3
**Hub Bore:** 56.1mm
**Critical:** STI has larger wheel/tire package

---

### Chevrolet Corvette (2014-2026)

**C7 (2014-2019) & C8 (2020+)**

All Corvette trims are **ALWAYS staggered**. Different widths per trim.

| Trim | Front | Rear | Notes |
|------|-------|------|-------|
| Stingray | 245/35R19 | 285/30R20 | Base C8 |
| Z51 | 245/35R19 | 305/30R20 | Performance package |
| Grand Sport | 285/30R19 | 335/25R20 | Wide body |
| Z06 | 275/30R19 | 345/25R20 | Track monster |
| ZR1 (C7) | 285/30R19 | 335/25R20 | Supercharged |

**Bolt Pattern:** 5x120.65 (C7), 5x120 (C8)
**Critical:** ALL orders must be staggered; widths vary significantly by trim

---

### Porsche 911 (2012-2026)

Every 911 variant has unique staggered setup. Critical to differentiate.

| Trim | Typical Front | Typical Rear | Notes |
|------|---------------|--------------|-------|
| Carrera | 245/35R20 | 295/30R20 | Base |
| Carrera S | 245/35R20 | 305/30R20 | Wider rear |
| Carrera 4/4S | Similar to above | AWD variants |
| GTS | 245/35R20 | 305/30R20 | Sport variant |
| Turbo | 255/35R20 | 315/30R20 | Wider both |
| Turbo S | 255/35R20 | 315/30R20 | Top spec |
| GT3 | 255/35R20 | 315/30R21 | Track focused |
| GT3 RS | 275/35R20 | 335/30R21 | Wide track |
| GT2 RS | 265/35R20 | 325/30R21 | Ultimate |

**Bolt Pattern:** 5x130
**Hub Bore:** 71.6mm
**Note:** Center-lock wheel variants exist for some trims

---

## Implementation Strategy

### Phase 1: Immediate (Week 1-2)
1. **Ford Mustang** — Highest volume, common customer confusion
2. **Chevrolet Camaro** — Similar volume, staggered complexity
3. **Dodge Challenger/Charger** — Popular, widebody distinction critical

### Phase 2: Near-term (Week 3-4)
4. **Chevrolet Corvette** — Always staggered, premium customers
5. **Porsche 911** — Complex but important for accuracy
6. **Tesla Model 3** — Growing EV segment

### Phase 3: Extended (Month 2)
7. **Subaru WRX** — Enthusiast base expects accuracy
8. **BMW M3/M4** — Premium segment
9. **Remaining Tier B** — As time allows

---

## Data Sources for Implementation

### Approved Sources (per TOOLS.md)
- **tiresize.com** — Primary source for OEM tire sizes by trim
- **Manufacturer spec sheets** — For bolt pattern/hub bore confirmation
- **Existing database records** — Some vehicles already differentiated

### Do NOT Use
- ~~wheel-size.com~~ — BANNED per TOOLS.md (legal risk)

---

## Estimated Effort

| Phase | Models | Estimated Records | Hours |
|-------|--------|-------------------|-------|
| Phase 1 | 3 | ~30-40 trims | 4-6 |
| Phase 2 | 3 | ~30-40 trims | 4-6 |
| Phase 3 | 4+ | ~20-30 trims | 3-4 |
| **Total** | **10** | **~80-110 trims** | **11-16** |

---

## Success Metrics

1. **Staggered accuracy:** 100% of staggered vehicles return `isStaggered: true`
2. **Wheel size accuracy:** Correct diameter/width for selected trim
3. **Customer confusion reduction:** Fewer support tickets about wrong fitment
4. **Zero over-expansion:** DO NOT touch single-trim vehicles that don't need it

---

## Appendix: Vehicles Already Handled

These vehicles already have trim differentiation or rules in the codebase:

| Vehicle | Implementation | Location |
|---------|---------------|----------|
| RAM 1500 Classic vs DT | vehicleFitmentRules.ts | ✅ Complete |
| Wrangler trims | submodel-supplements.json | ✅ Partial |
| Jeep trims | submodel-supplements.json | ✅ Partial |

---

## Appendix: Decision Tree

```
Does the model have performance trims?
├── Yes → Check wheel size differences
│   ├── >1" diameter difference → DIFFERENTIATE (Tier A)
│   ├── Staggered vs non-staggered → DIFFERENTIATE (Tier A)
│   └── Same specs → Leave as single-trim
└── No → Leave as single-trim (Tier C)
```

---

*Document maintained by Warehouse Tire Direct fitment team*
