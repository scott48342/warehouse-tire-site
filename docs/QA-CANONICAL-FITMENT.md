# QA Matrix: Canonical Fitment Resolution

## Test Date: 2026-05-04

## Background
Fixed grouped trim identity issue where "LX, Sport, EX" would share a single modificationId,
causing resolution failures when user selects a specific trim.

## Test Endpoints
- `/api/vehicles/trims` - Should return atomic options with unique canonicalFitmentIds
- `/api/vehicles/tire-sizes` - Should resolve to exact trim, not grouped record

---

## Test Matrix

### 1. Mustang Trims (Different Tire Sizes)

| Trim | Expected Tire Sizes | Expected Behavior |
|------|---------------------|-------------------|
| EcoBoost | 235/55R17, 255/40R18 | Should show only EcoBoost sizes |
| GT | 255/40R18, 255/40R19 | Should show only GT sizes |
| GT Performance Pack | 255/40R19, 275/40R19 (staggered) | Should show staggered, NOT need wheel selection |
| Shelby GT500 | 295/35R20, 305/30R20 (staggered) | Should show staggered |

**Test URLs:**
```
/api/vehicles/trims?year=2024&make=Ford&model=Mustang
/api/vehicles/tire-sizes?year=2024&make=Ford&model=Mustang&modification=ford-mustang-gt-performance-pack-7e97e158f4
```

---

### 2. F-150 Trims (Multiple Wheel Sizes)

| Trim | Expected Behavior |
|------|-------------------|
| XL | 265/70R17 - single size |
| XLT | May have multiple (18", 20") - legitimate gate |
| Raptor | 315/70R17 - single size |
| Limited | May have multiple - legitimate gate |

**Test URLs:**
```
/api/vehicles/trims?year=2024&make=Ford&model=F-150
/api/vehicles/tire-sizes?year=2024&make=Ford&model=F-150&modification=ford-f-150-raptor-abf01093
```

---

### 3. Honda Accord (Grouped Trim Issue)

This was a key issue: "Sport, LX, EX, Touring" grouped together.

| Trim | Expected Behavior |
|------|-------------------|
| Sport | Should resolve to Sport-specific fitment |
| LX | Should resolve to LX-specific fitment |
| EX | Should resolve to EX-specific fitment |

**Test URLs:**
```
/api/vehicles/trims?year=2024&make=Honda&model=Accord
/api/vehicles/tire-sizes?year=2024&make=Honda&model=Accord&trim=Sport
```

**Expected:**
- Trims API returns each trim with UNIQUE value (canonicalFitmentId)
- NOT all sharing the same modificationId

---

### 4. Chevrolet Blazer (Known Inconsistent)

From audit: "RS, Premier" has 4 tire sizes, "L, 1LT, 2LT" has 1 size.

| Trim | Expected Behavior |
|------|-------------------|
| RS | Should show RS sizes only (multiple wheel packages may be legitimate) |
| Premier | Should show Premier sizes only |
| L | Should show L sizes only (likely single size) |
| LT | Should show LT sizes only |

**Test URLs:**
```
/api/vehicles/trims?year=2023&make=Chevrolet&model=Blazer
/api/vehicles/tire-sizes?year=2023&make=Chevrolet&model=Blazer&trim=RS
```

---

### 5. Silverado 1500 (Known Inconsistent)

From audit: Different trim groups have different tire sizes.

| Trim | Expected Behavior |
|------|-------------------|
| WT | Should resolve to WT fitment |
| LT | Should resolve to LT fitment |
| LTZ | Should resolve to LTZ fitment |
| High Country | Should resolve to High Country fitment |

**Test URLs:**
```
/api/vehicles/trims?year=2018&make=Chevrolet&model=Silverado-1500
/api/vehicles/tire-sizes?year=2018&make=Chevrolet&model=Silverado-1500&trim=WT
```

---

### 6. Staggered Vehicles

| Vehicle | Trim | Expected |
|---------|------|----------|
| Mustang GT PP | GT Performance Pack | Staggered: 255/40R19 F, 275/40R19 R |
| Corvette | Stingray | Staggered: different F/R sizes |
| Camaro SS | SS 1LE | Staggered |

**Expected:** 
- `needsWheelSelection: false` for staggered
- Both front and rear sizes returned

---

### 7. Package Flow

Test that package builder uses same resolution:
```
/packages?year=2024&make=Ford&model=Mustang&modification=ford-mustang-gt-95abdd79aa
```

**Expected:**
- Wheel selection followed by tire selection
- Tire sizes match the selected trim

---

### 8. POS Flow

Test local store flow (if applicable):
```
/pos/build?year=2024&make=Ford&model=F-150&modification=ford-f-150-xlt-913eb9b2
```

---

## Success Criteria

1. ✅ Multiple-size chooser only appears when selected trim truly has multiple OEM packages
2. ✅ Grouped trims not exposed to customers (each shows as individual option)
3. ✅ No model-level fallback after trim selection
4. ✅ Tire, wheel, and package flows resolve same vehicle identity
5. ✅ Debug fields in API response show resolution path

## Debug Response Fields

Check that tire-sizes API includes:
```json
{
  "debug": {
    "requestedTrim": "GT Performance Pack",
    "normalizedRequestedTrim": "...",
    "candidateTrims": [...],
    "matchedTrim": "GT Performance Pack",
    "matchedBy": "exact_canonical_trim",
    "modificationId": "ford-mustang-gt-performance-pack-7e97e158f4",
    "tireSizesFound": ["255/40R19", "275/40R19"],
    "fallbackBlockedReason": null
  }
}
```

---

## Rollback Plan

If issues found:
1. Revert commit: `git revert 3dfa671`
2. Old behavior preserved in safeResolver.ts (still exists)
