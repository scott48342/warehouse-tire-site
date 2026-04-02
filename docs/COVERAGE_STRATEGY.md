# Warehouse Tire Direct - Vehicle Coverage Strategy

**Last Updated:** 2026-04-01  
**Status:** GOOD - Focus on Maintenance & Edge Cases

---

## Executive Summary

Our vehicle fitment database has **excellent coverage** of high-value vehicles:

| Metric | Value | Status |
|--------|-------|--------|
| Total Makes | 35 | ✅ All major brands |
| Total Models | 247 | ✅ Comprehensive |
| Y/M/M Combos | 1,231 | ✅ Strong depth |
| With Fitment Data | 99.7% | ✅ Excellent |
| With Wheel Specs | 99.4% | ✅ Excellent |
| Tier 1 Vehicles Complete | 12/12 (100%) | ✅ Perfect |
| Tier 2 Vehicles Complete | 20/20 (100%) | ✅ Perfect |
| Year Range | 1969-2026 | ✅ Wide coverage |

**Bottom line:** We have complete data for the vehicles that matter most. The strategy should focus on **maintaining quality** and **handling edge cases gracefully** rather than filling major gaps.

---

## What We Cover Well

### Tier 1: Must-Have Vehicles (100% Complete)
All top-selling, high-margin vehicles have complete fitment and wheel spec data:

| Vehicle | Years | Bolt Pattern | Notes |
|---------|-------|--------------|-------|
| Ford F-150 | 9 years | 6x135 | #1 selling vehicle in US |
| Chevy Silverado 1500 | 7 years | 6x139.7 | #2 selling truck |
| Ram 1500 | 9 years | 6x139.7 | Multiple trims including Hurricane |
| Toyota RAV4 | 8 years | 5x114.3 | #1 selling SUV |
| Honda CR-V | 4 years | 5x114.3 | Top compact SUV |
| Tesla Model Y | 3 years | 5x114.3 | Best-selling EV |
| Toyota Camry | 9 years | 5x114.3 | Best-selling sedan |
| Honda Civic | 2 years | 5x114.3 | Strong sedan market |
| Toyota Tacoma | 9 years | 6x139.7 | Top mid-size truck |
| Jeep Wrangler | 8 years | 5x127 | Popular for aftermarket wheels |
| Jeep Grand Cherokee | 8 years | 5x127 | SUV leader |
| Ford Explorer | 9 years | 5x114.3 | Family SUV segment |

### Tier 2: High-Value Vehicles (100% Complete)
- **Full-size trucks:** GMC Sierra 1500, Ford F-250, Chevy Silverado 2500 HD, Toyota Tundra
- **SUVs:** Ford Bronco, Chevrolet Tahoe, Ford Expedition, Honda Pilot, Nissan Rogue, Subaru Outback/Forester, Toyota Highlander
- **Performance:** Ford Mustang, Chevy Camaro, Dodge Challenger/Charger
- **Crossovers:** Ford Escape, Chevy Equinox
- **EVs:** Tesla Model 3

### Tier 3: Luxury & Enthusiast (100% Complete)
- **German:** BMW 3/5 Series, Mercedes C-Class, Audi A4
- **Japanese Luxury:** Lexus RX
- **Mainstream:** Mazda CX-5, Hyundai Tucson, Kia Sportage, Chevy Colorado, Ford Ranger

### Make Coverage (2018+ Vehicles)
| Make | Models | Trims | Fitment % | Spec % |
|------|--------|-------|-----------|--------|
| Ford | 14 | 70 | 100% | 100% |
| Toyota | 13 | 62 | 100% | 100% |
| Chevrolet | 15 | 49 | 100% | 100% |
| Lexus | 9 | 37 | 100% | 97% |
| Jeep | 6 | 35 | 100% | 97% |
| Honda | 9 | 28 | 100% | 100% |
| BMW | 9 | 26 | 100% | 100% |
| All others | - | - | 100% | 100% |

---

## What We Don't Cover (Yet)

### Known Gaps

1. **Very Old Vehicles (pre-1990)**
   - Limited fitment data for classic cars
   - Strategy: Offer "Contact Us" for classic vehicle fitment

2. **Rare/Exotic Makes**
   - Alfa Romeo, Maserati, Lotus, McLaren, etc.
   - Strategy: Not a priority - low volume, specialist customers know their fitment

3. **New Model Year Trims (late-year releases)**
   - 2026 vehicles still being populated
   - Strategy: Prioritize top-sellers first, add others as data becomes available

4. **Commercial Vehicles**
   - Ford Transit, Mercedes Sprinter, etc.
   - Strategy: Add if demand warrants; these customers often contact sales directly

5. **Regional/Market-Specific Models**
   - Some vehicles only sold in specific markets
   - Strategy: Focus on US-market vehicles

### Edge Cases

| Scenario | Current Coverage | Recommendation |
|----------|-----------------|----------------|
| Customer has rare trim | May not find exact match | Show closest match + "Contact for exact fitment" |
| Customer has modified vehicle | No data | Show OEM specs + disclaimer about modifications |
| Customer has very old vehicle | Partial data | Show "Classic vehicle? Contact us for help" |
| Split-fitment/staggered setup | Supported | Already handled in wheel specs |

---

## UI/UX Recommendations

### 1. Vehicle Selection Flow

**Current state:** Users select Year → Make → Model → Trim

**Recommendations:**
- ✅ Show all 35 makes (we have full coverage)
- ✅ Show all models with data (don't hide anything)
- ✅ Show all available trims - if only 1 trim exists, auto-select it
- Add "Don't see your vehicle? Contact us" link at bottom

### 2. Handling Missing Data

**If vehicle not found:**
```
Can't find your vehicle? Don't worry!
[Search by tire size instead] [Contact us for fitment help]
```

**If fitment data incomplete:**
```
We have limited data for this vehicle.
Showing general specifications - verify with a professional before purchasing.
[Get expert help] (links to contact form)
```

### 3. Search Behavior

- **Primary:** Vehicle-based search (Y/M/M/Trim)
- **Fallback:** Tire size search ("275/55R20")
- **Expert mode:** Bolt pattern + diameter search (for enthusiasts)

### 4. Product Pages

- Always show fitment compatibility when vehicle is selected
- "Fits your [Year Make Model Trim]" badge
- Show bolt pattern, center bore, offset range for verification

### 5. Confidence Indicators

| Data Quality | Display |
|--------------|---------|
| Complete (fitment + specs) | ✅ "Verified fitment" |
| Partial (fitment only) | ⚠️ "General fitment - verify specs" |
| None | Show size-based search, no vehicle lock |

---

## Roadmap for Improvement

### Phase 1: Maintain Excellence (Ongoing)
- [ ] Keep 2024-2026 model years current as new trims release
- [ ] Monitor for fitment spec updates (mid-year changes)
- [ ] Address any reported fitment issues immediately

### Phase 2: Fill Minor Gaps (Q2 2026)
- [ ] Add remaining 2026 model year trims
- [ ] Improve Porsche coverage (currently 83%)
- [ ] Review Lexus/Jeep spec gaps (97% coverage)

### Phase 3: Expand Coverage (Q3 2026)
- [ ] Add popular classic vehicles (1990-2000 muscle cars)
- [ ] Commercial vehicles if demand warrants
- [ ] Additional luxury brands (Maserati, Alfa Romeo)

### Phase 4: Data Quality (Q4 2026)
- [ ] Audit existing data against OEM specs
- [ ] Add plus-size fitment recommendations
- [ ] Integrate staggered/split fitment guidance

---

## Data Sources & Maintenance

### Current Sources
- Wheel-Size API (primary)
- OEM spec sheets
- Manual verification for popular vehicles

### Update Frequency
- **New model years:** As released (prioritize Tier 1)
- **Spec corrections:** Within 24 hours of report
- **Full audit:** Annually

### Quality Metrics to Track
- Fitment coverage % by year
- Customer fitment complaints/returns
- "Vehicle not found" search frequency
- Contact form requests for fitment help

---

## Technical Notes

### Database Structure
```
vehicles (1,232 records)
├── vehicle_fitment (1,228 records) - bolt pattern, center bore, thread size
└── vehicle_wheel_specs (5,854 records) - rim sizes, offsets, tire sizes
```

### Key Tables
- `vehicles` - Year, Make, Model, Trim
- `vehicle_fitment` - Bolt pattern (5x114.3), center bore (67.1mm), thread size (M12x1.5)
- `vehicle_wheel_specs` - OEM rim diameters, widths, offsets, tire sizes

### Lookup Flow
1. User selects Y/M/M/Trim
2. Lookup `vehicle_fitment` for bolt pattern + center bore
3. Lookup `vehicle_wheel_specs` for compatible sizes
4. Filter wheel products by matching specs
5. Display compatible products with confidence badge

---

## Conclusion

**We are in excellent shape.** The "Accept Limited Coverage" strategy should focus on:

1. **Don't panic** - We have 100% coverage of high-value vehicles
2. **Graceful degradation** - Handle edge cases with helpful fallbacks
3. **Maintain quality** - Keep existing data accurate and current
4. **Communicate clearly** - Users should always have a path forward

The primary risk is not coverage gaps - it's **data accuracy**. A wrong bolt pattern or offset causes returns. Focus QA efforts on verifying critical specs for top-selling vehicles.

---

*Generated by coverage analysis script: `scripts/full-coverage-analysis.js`*  
*Report data: `scripts/full-coverage-report.json`*
