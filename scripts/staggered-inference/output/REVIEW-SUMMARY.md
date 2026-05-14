# Staggered Front/Rear Inference Review Pipeline

**Generated:** 2026-05-14T11:55:08.965Z  
**Mode:** REVIEW ONLY - NO DB WRITES

---

## Summary

| Metric | Count |
|--------|-------|
| **Total Records Analyzed** | 5,285 |
| **Total Proposals** | 2,384 |
| **✅ Approve Candidates** | 463 |
| **🔍 Review Candidates** | 1,924 |
| **❌ Reject Candidates** | 0 |
| **⬜ Square Setups (skipped)** | 0 |
| **📭 No Tire Data** | 144 |

---

## High-Confidence Mappings (≥95%) by Make

| Make | Count |
|------|-------|
| BMW | 262 |
| Chevrolet | 139 |
| Cadillac | 36 |
| Audi | 20 |
| Acura | 6 |

---

## Top 20 Platforms by High-Confidence Mappings

| Platform | Count |
|----------|-------|
| Chevrolet Camaro | 70 |
| BMW Z4 | 52 |
| Chevrolet Corvette | 40 |
| BMW M5 | 37 |
| Cadillac Escalade ESV | 36 |
| BMW M4 | 36 |
| BMW M3 | 25 |
| BMW X6 M | 16 |
| Chevrolet Silverado 1500 | 14 |
| BMW 5 Series | 14 |
| BMW X6 | 10 |
| BMW M8 | 8 |
| Audi S6 | 8 |
| BMW 8 Series | 7 |
| BMW M6 | 7 |
| BMW X5 M | 7 |
| Acura MDX | 6 |
| BMW i8 | 6 |
| BMW X4 M | 5 |

---

## Inference Logic Applied

### Rule 1: Same Rim Diameter, Different Widths (99% confidence for Tier A)
```
245/35R19 front
305/30R19 rear
→ Narrower = front, wider = rear
```

### Rule 2: Different Rim Diameters (95-97% confidence)
```
275/30R19 front
285/30R20 rear
→ Smaller rim + narrower = front, larger rim + wider = rear
```

### Rule 3: Multi-Size Patterns (85-92% confidence)
```
Multiple tire size options → Select largest diameter pair, apply width rule
```

### Rule 4: Manual Review Required
- Same width, conflicting diameters
- Exotic dual-axle configurations
- Unclear pairs (3+ unique sizes with no obvious pattern)

---

## Confidence Scoring

| Score | Criteria |
|-------|----------|
| **99%** | Clear width diff + known performance platform (Tier A) + known trim |
| **97%** | Clear width diff + known performance platform (Tier A) |
| **95%** | Clear width diff, platform not pre-approved |
| **90-93%** | Different rim diameters, clear width pattern |
| **85-88%** | Multi-size selection from 3+ options |
| **70%** | Unusual pattern (smaller rim wider) - needs review |
| **Manual** | Ambiguous patterns |

---

## Tier A Platforms (Pre-Approved)

- Chevrolet Corvette
- Chevrolet Camaro
- Ford Mustang
- BMW M3 / M4 / M5
- Nissan GT-R
- Porsche 911 / Boxster / Cayman / 718

---

## Sample High-Confidence Mappings

### 2024 Chevrolet Camaro ZL1 1LE
- **Front:** 305/30R19
- **Rear:** 325/30R19
- **Confidence:** 99%
- **Reason:** Same rim (19"), width diff: 305mm front / 325mm rear
- **OEM Wheels:** 11" front / 11.5" rear

### 2025 BMW M4 Competition
- **Front:** 275/35R19
- **Rear:** 285/30R20
- **Confidence:** 97%
- **Reason:** Diff rim: 19" front (275mm) / 20" rear (285mm)
- **OEM Wheels:** 9.5" front / 10.5" rear

### 2024 Chevrolet Corvette Z06
- **Front:** 275/30ZR20
- **Rear:** 345/25ZR21
- **Confidence:** 97%
- **Reason:** Diff rim: 20" front (275mm) / 21" rear (345mm)

---

## Output Files

- **Full JSON:** `staggered-proposals-2026-05-14T11-55-08.json`
- **High-confidence subset:** 100 mappings in `highConfidenceMappings` array
- **All proposals:** 2,384 mappings in `allProposals` array

---

## Next Steps

1. **Review approve candidates** (463 total) - These are ready for batch application
2. **Review candidates** (1,924) - Need human verification before applying
3. **Create migration script** - Apply approved mappings to `vehicle_fitments` table
4. **Add front/rear fields** - May need schema update to store `frontTireSize` / `rearTireSize`

---

⚠️ **REMINDER:** This is REVIEW ONLY. No database changes were made.  
Review the JSON output and apply changes manually after verification.
