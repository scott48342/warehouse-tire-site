# QA Failures Report

**Total Failures:** 50 / 50
**Run ID:** `unknown`

---

## 🔴 CRITICAL (11)

### 2024 Ford Mustang GT

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Bolt Pattern | 5x114.3 ✅ |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly
- [package] Package flow not viable: missing wheels or tires

### 2023 Ford Mustang GT Performance Pack

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Bolt Pattern | 5x114.3 ✅ |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly
- [package] Package flow not viable: missing wheels or tires

### 2024 Chevrolet Camaro SS

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Bolt Pattern | 5x120 ✅ |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly
- [package] Package flow not viable: missing wheels or tires

### 2023 Chevrolet Camaro ZL1

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Bolt Pattern | 5x120 ✅ |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly
- [package] Package flow not viable: missing wheels or tires

### 2024 Dodge Challenger R/T

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly

### 2023 Chevrolet Corvette Stingray

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Bolt Pattern | 5x120 ✅ |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly
- [package] Package flow not viable: missing wheels or tires

### 2024 Lexus LX 600

| Field | Value |
|-------|-------|
| Category | suv |
| Failure Type | logic |
| Bolt Pattern | 5x150 ❌ |

**Errors:**
- [critical] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [wheel] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [tire] Zero tires returned
- [lift-4] Tire diameter 29" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 29" outside expected band 35-37" for 6" lift

### 2018 Ram 1500 Express

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |
| Bolt Pattern | 5x139.7 ❌ |

**Errors:**
- [critical] Bolt pattern mismatch: expected 6x139.7, got 5x139.7
- [wheel] Bolt pattern mismatch: expected 6x139.7, got 5x139.7
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-40" for 8" lift

### 2023 Dodge Challenger Hellcat

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly

### 2024 BMW M3 Competition

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Bolt pattern mismatch: expected 5x112, got null
- [wheel] Zero wheels returned
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false
- [package] Package flow not viable: missing wheels or tires

### 2018 Jeep Wrangler JK Unlimited

| Field | Value |
|-------|-------|
| Category | jeep |
| Failure Type | logic |

**Errors:**
- [critical] Bolt pattern mismatch: expected 5x127, got null
- [wheel] Zero wheels returned
- [tire] Zero tires returned
- [lift-2] Zero wheels for 2" lift
- [lift-4] Zero wheels for 4" lift

## 🟠 HIGH (17)

### 2024 Ford F-150 XLT

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |
| Bolt Pattern | 6x135 ✅ |

**Errors:**
- [high] Lifted tire diameter 33" outside band 35-37" for 6" lift
- [lift-6] Tire diameter 33" outside expected band 35-37" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Chevrolet Silverado 1500 LT

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 33-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Ram 1500 Big Horn

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 33-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 GMC Sierra 1500 SLT

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 33" outside band 35-37" for 6" lift
- [lift-6] Tire diameter 33" outside expected band 35-37" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford F-250 XLT

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | logic |
| Bolt Pattern | 8x170 ✅ |

**Errors:**
- [high] Lifted tire diameter 34" outside band 35-37" for 4" lift
- [lift-4] Tire diameter 34" outside expected band 35-37" for 4" lift
- [lift-6] Tire diameter 34" outside expected band 37-40" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Ram 2500 Big Horn

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | logic |
| Bolt Pattern | 8x165.1 ✅ |

**Errors:**
- [high] Lifted tire diameter 33" outside band 35-37" for 4" lift
- [lift-4] Tire diameter 33" outside expected band 35-37" for 4" lift
- [lift-6] Tire diameter 33" outside expected band 37-40" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Jeep Wrangler Rubicon

| Field | Value |
|-------|-------|
| Category | jeep |
| Failure Type | logic |
| Bolt Pattern | 5x127 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 35-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 35-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 37-37" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford Bronco Wildtrak

| Field | Value |
|-------|-------|
| Category | bronco |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 33-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Toyota Tundra SR5

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 33" outside band 35-37" for 6" lift
- [lift-6] Tire diameter 33" outside expected band 35-37" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2023 Toyota 4Runner TRD Pro

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 33-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-38" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford F-250 Lariat

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | logic |
| Bolt Pattern | 8x170 ✅ |

**Errors:**
- [high] Lifted tire diameter 34" outside band 35-37" for 4" lift
- [lift-4] Tire diameter 34" outside expected band 35-37" for 4" lift
- [lift-6] Tire diameter 34" outside expected band 37-40" for 6" lift
- [lift-8] Tire diameter 34" outside expected band 37-42" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Nissan Frontier SV

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | logic |
| Bolt Pattern | 6x114.3 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 33-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-38" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2023 Ford F-350 King Ranch

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | logic |
| Bolt Pattern | 8x170 ✅ |

**Errors:**
- [high] Lifted tire diameter 34" outside band 35-37" for 4" lift
- [lift-4] Tire diameter 34" outside expected band 35-37" for 4" lift
- [lift-6] Tire diameter 34" outside expected band 37-40" for 6" lift
- [lift-8] Tire diameter 34" outside expected band 37-42" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 GMC Sierra 1500 AT4

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 33" outside band 35-37" for 6" lift
- [lift-6] Tire diameter 33" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 33" outside expected band 35-40" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Toyota Tacoma TRD Off-Road

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 33-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-38" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Toyota Tacoma TRD Sport

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | logic |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [high] Lifted tire diameter 32" outside band 33-35" for 4" lift
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-38" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Audi RS5 Sportback

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Bolt Pattern | 5x112 ✅ |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [high] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [staggered] Staggered mismatch: expected=true, detected=false
- [package] Package flow not viable: missing wheels or tires

## 🟡 MEDIUM (19)

### 2024 Chevrolet Silverado 2500 HD LT

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | supplier |
| Bolt Pattern | 8x180 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 32" outside expected band 35-37" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 37-40" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Jeep Gladiator Rubicon

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | supplier |
| Bolt Pattern | 5x127 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 29" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 29" outside expected band 35-37" for 6" lift
- [package] Package flow not viable: missing wheels or tires

### 2024 Honda Accord Sport

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Toyota Camry SE

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Toyota RAV4 XLE

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Tesla Model Y Long Range

| Field | Value |
|-------|-------|
| Category | ev |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Subaru Outback Premium

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 GMC Canyon AT4

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | supplier |
| Bolt Pattern | 6x120 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-38" for 8" lift

### 2024 GMC Yukon SLT

| Field | Value |
|-------|-------|
| Category | suv |
| Failure Type | supplier |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-6] Tire diameter 33" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 33" outside expected band 35-40" for 8" lift
- [package] Package flow not viable: missing wheels or tires

### 2023 Jeep Gladiator Rubicon

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | supplier |
| Bolt Pattern | 5x127 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 29" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 29" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 29" outside expected band 35-38" for 8" lift

### 2024 Chevrolet Bolt EUV Premier

| Field | Value |
|-------|-------|
| Category | ev |
| Failure Type | supplier |
| Bolt Pattern | 5x105 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Toyota Sequoia SR5

| Field | Value |
|-------|-------|
| Category | suv |
| Failure Type | supplier |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-40" for 8" lift

### 2012 Chevrolet Silverado 2500 HD LT

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | supplier |
| Bolt Pattern | 8x180 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 32" outside expected band 35-37" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 37-40" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 37-42" for 8" lift

### 2024 Ford Expedition XLT

| Field | Value |
|-------|-------|
| Category | suv |
| Failure Type | supplier |
| Bolt Pattern | 6x135 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 35-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 35-40" for 8" lift

### 2024 Toyota Camry XLE

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Nissan Altima SV

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2022 Ford Bronco Raptor

| Field | Value |
|-------|-------|
| Category | jeep |
| Failure Type | supplier |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [lift-4] Tire diameter 32" outside expected band 35-35" for 4" lift
- [lift-6] Tire diameter 32" outside expected band 37-37" for 6" lift
- [lift-8] Tire diameter 32" outside expected band 37-40" for 8" lift

### 2024 Volkswagen Jetta SE

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x112 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Honda Civic Touring

| Field | Value |
|-------|-------|
| Category | car |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

## 🟢 LOW (3)

### 2024 Chevrolet Tahoe LT

| Field | Value |
|-------|-------|
| Category | suv |
| Failure Type | inventory |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford Mustang Mach-E Premium

| Field | Value |
|-------|-------|
| Category | ev |
| Failure Type | inventory |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Hyundai Ioniq 5 Limited

| Field | Value |
|-------|-------|
| Category | ev |
| Failure Type | inventory |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires
