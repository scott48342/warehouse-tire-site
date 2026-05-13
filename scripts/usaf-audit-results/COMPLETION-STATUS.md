# USAF 2000-Current Completion Status Dashboard
Generated: 2026-05-13 11:55 AM EST

## Overall Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total Vehicles Audited** | 9,226 | 100% |
| Exact Match (no action needed) | 1,480 | 16.0% |
| Partial Match (enrichment possible) | 3,106 | 33.7% |
| WTD Only (no USAF data) | 3,917 | 42.5% |
| USAF Only (missing from WTD) | 559 | 6.1% |

## Action Queues

| Category | Count | Status |
|----------|-------|--------|
| 🟢 **Safe Auto-Fix** | 218 | Ready to apply |
| 🟡 **Legacy Fallback** | 1,038 | Needs validation |
| 🟠 **Config Table Candidates** | 202 | Needs admin review |
| 🔴 **Manual Review Required** | 3,460 | Human intervention |
| ⚠️ **Errors (need retry)** | 164 | Code fix required |

## Batch Breakdown

| Batch | Total | Exact | Partial | WTD Only | USAF Only | Safe | Legacy | Config | Manual | Errors |
|-------|-------|-------|---------|----------|-----------|------|--------|--------|--------|--------|
| 01 | 1,000 | 161 | 314 | 433 | 92 | 23 | 75 | 44 | 565 | 0 |
| 02 | 1,000 | 161 | 345 | 446 | 48 | 30 | 48 | 49 | 426 | 0 |
| 03 | 1,000 | 181 | 359 | 429 | 31 | 41 | 52 | 36 | 346 | 0 |
| 04 | 1,000 | 344 | 233 | 238 | 21 | 18 | 61 | 35 | 210 | **164** |
| 05 | 1,000 | 132 | 394 | 448 | 26 | 31 | 93 | 38 | 324 | 0 |
| 06 | 1,000 | 119 | 394 | 456 | 31 | 30 | 151 | 0 | 310 | 0 |
| 07 | 1,000 | 117 | 366 | 447 | 70 | 9 | 177 | 0 | 415 | 0 |
| 08 | 1,000 | 128 | 337 | 449 | 86 | 13 | 190 | 0 | 391 | 0 |
| 09 | 1,000 | 117 | 300 | 465 | 118 | 21 | 158 | 0 | 366 | 0 |
| 10 | 226 | 20 | 64 | 106 | 36 | 2 | 33 | 0 | 107 | 0 |

---

## 1. Safe Auto-Fixes (218 total)

**Criteria**: 100% confidence, existing wheel diameter, standard P-metric format, no conflicts

### Sample (Top 50):
```
2026 BMW X5: 295/35R21
2026 BMW X5: 275/35R22
2026 BMW X6: 295/35R21
2026 Ford f-150: 275/65R18
2026 Ford f-150: 245/70R17
2025 BMW X5: 295/35R21
2025 BMW X5: 275/35R22
2025 BMW X6: 295/35R21
2025 Chevrolet Silverado 1500: 265/70R17
2025 Dodge durango: 255/60R18
2025 Ford f-150: 245/70R17
2025 Ford f-150: 275/65R18
2025 Jeep Wrangler: 255/60R20
2024 BMW X3: 255/45R20
2024 BMW X3: 265/45R20
2024 BMW X3: 265/40R21
2024 BMW X3: 275/35R21
2024 BMW X5: 275/35R22
2024 BMW X6: 295/35R21
2024 Chevrolet Silverado 1500: 265/70R17
2024 Ford f-150: 245/70R17
2024 Ford f-150: 275/65R18
2023 BMW X3: 255/45R20
2023 BMW X3: 265/45R20
2023 BMW X3: 265/40R21
2023 BMW X3: 275/35R21
2023 BMW X5: 275/35R22
2023 BMW X5: 295/35R21
2023 BMW X6: 295/35R21
2023 Chevrolet Silverado 1500: 265/70R17
2023 Ford f-150: 275/65R18
2023 Ford f-150: 245/70R17
2023 Jeep Renegade: 215/65R17
2022 BMW X3: 255/45R20
2022 BMW X3: 265/45R20
2022 BMW X3: 265/40R21
2022 BMW X3: 275/35R21
2022 BMW X5: 295/35R21
2022 BMW X5: 275/35R22
2022 BMW X6: 295/35R21
2022 Chevrolet Silverado 1500: 265/70R17
2022 Ford f-150: 275/65R18
2022 Ford f-150: 245/70R17
2022 GMC Sierra 1500: 255/70R17
2022 GMC Sierra 1500: 275/50R22
2022 Jaguar e-pace: 235/50R20
2022 Jaguar f-pace: 295/40R21
```

---

## 2. Legacy Fallback Candidates (1,038 total)

**Criteria**: Uses existing wheel diameter pattern from similar vehicles, lower confidence

### Sample (Top 30):
```
2026 Audi q3: 255/45R19
2026 Audi q3: 255/40R20
2026 BMW X3: 255/45R20
2026 BMW X3: 285/40R20
2026 BMW X3: 255/40R21
2026 BMW X3: 285/35R21
2026 Cadillac ct5: 275/35R19
2026 Cadillac ct5: 305/30R19
2026 Cadillac ct5: 285/35R19
2026 Ford maverick: 235/65R17
2026 GMC acadia: 265/65R18
2026 GMC acadia: 255/65R18
2026 Genesis g80: 245/50R18
2026 Genesis g80: 245/45R19
2026 Genesis g80: 275/40R19
2026 Genesis g80: 245/40R20
2026 Honda Passport: 275/60R18
2026 Hyundai kona: 215/55R18
2026 Hyundai palisade: 255/50R20
2026 Land Rover Range Rover Sport: 305/40R22
```

---

## 3. Config Table Candidates (202 total)

**Criteria**: Needs tire-config table entry, complex vehicle (multiple trims/options)

### Sample (Top 50):
```
2026 Acura integra: 235/40R18
2026 Acura integra: 265/30R19
2026 Audi q5: 235/55R19
2026 Cadillac ct4: 255/35R18
2026 Cadillac ct4: 275/35R18
2026 Chevrolet suburban: 275/50R22
2026 Chevrolet tahoe: 285/40R24
2026 Chevrolet tahoe: 275/55R20
2026 Ford expedition: 275/60R20
2026 Ford expedition: 275/50R22
2026 Ford expedition: 275/70R18
2026 GMC yukon: 275/50R22
2026 GMC yukon: 285/40R24
2026 Lincoln navigator: 275/50R22
2025 Acura integra: 235/40R18
2025 Acura integra: 265/30R19
2025 Cadillac ct4: 255/35R18
2025 Cadillac ct4: 275/35R18
2025 Chevrolet tahoe: 275/55R20
2025 Chevrolet tahoe: 285/40R24
2025 GMC yukon: 275/50R22
2025 GMC yukon: 285/40R24
2025 Lincoln navigator: 275/50R22
2024 Acura integra: 265/30R19
2024 Acura integra: 235/40R18
2024 Audi q3: 255/45R19
2024 Audi q3: 255/40R20
2024 Cadillac ct4: 255/35R18
2024 Cadillac ct4: 275/35R18
2024 Chevrolet colorado: 265/65R18
```

---

## 4. Errors Needing Retry (164 total)

**Error**: `tireSizes is not iterable` — USAF returned null/invalid response

### All Errors (from Batch 04):
```
2018 Acura NSX
2018 Alfa Romeo 4C
2018 Alfa Romeo Giulia
2018 Alfa Romeo Stelvio
2018 Aston Martin DB11
2018 Aston Martin Rapide
2018 Aston Martin Vanquish
2018 Audi R8
2018 Audi RS3
2018 BMW 230i
2018 BMW 230i xDrive
2018 BMW 320i
2018 BMW 320i xDrive
2018 BMW 328d
2018 BMW 328d xDrive
2018 BMW 330e
2018 BMW 330i
2018 BMW 330i GT xDrive
2018 BMW 330i xDrive
2018 BMW 340i
... (144 more vehicles from 2018)
```

**Root Cause**: Code bug — needs defensive check for null/non-array tireSizes from USAF API.

**Fix Required**:
```javascript
const tireSizes = Array.isArray(usafResponse.tireSizes) ? usafResponse.tireSizes : [];
```

---

## 5. USAF-Only Vehicles (559 total)

Vehicles USAF has data for that WTD database is missing entirely.

**By Make (top patterns)**:
- Many 2018-2019 European luxury vehicles
- Some exotic/low-volume models
- Recent model year additions

---

## 6. WTD-Only Vehicles (3,917 total)

Vehicles in WTD that USAF cannot provide data for.

**Likely causes**:
- Older vehicles (pre-2010)
- Commercial/fleet vehicles
- Rare/discontinued models
- Regional variants

---

## Recommended Next Apply Batch

### Lowest Regression Risk Order:

1. **Safe Auto-Fix (218)** — Apply first
   - All 100% confidence
   - Existing wheel diameters
   - Standard formats
   - Zero risk

2. **Config Table Candidates (202)** — After admin review
   - Require tire_configs table entries
   - Moderate complexity

3. **Legacy Fallback (1,038)** — After validation
   - Use wheel diameter from similar vehicles
   - Higher risk, needs spot-checking

4. **Retry Errors (164)** — After code fix
   - Fix the `tireSizes is not iterable` bug
   - Re-run batch 04 vehicles

5. **Manual Review (3,460)** — Last priority
   - Requires human judgment
   - Conflicts, ambiguous data

---

## Files

- `batch-01.json` through `batch-10.json` — Raw audit results
- `COMPLETION-STATUS.md` — This dashboard

---

*Last updated: 2026-05-13 11:55 AM EST*
