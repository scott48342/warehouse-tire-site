# QA Failures Report

**Total Failures:** 20 / 20
**Run ID:** `unknown`

---

## 🔴 CRITICAL (3)

### 2024 Dodge Challenger R/T

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |

**Errors:**
- [critical] Bolt pattern mismatch: expected 5x115, got null
- [wheel] Zero wheels returned
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Chevrolet Camaro 1LE

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

### 2024 Dodge Challenger Widebody

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

## 🟡 MEDIUM (8)

### 2023 Ford Mustang GT Performance Pack

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Chevrolet Camaro SS

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | supplier |
| Bolt Pattern | 5x120 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2023 Chevrolet Camaro ZL1

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | supplier |
| Bolt Pattern | 5x120 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2023 Chevrolet Corvette Stingray

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | supplier |
| Bolt Pattern | 5x120 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford Mustang GT

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford Mustang Dark Horse

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | supplier |
| Bolt Pattern | 5x114.3 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
- [package] Package flow not viable: missing wheels or tires

### 2024 Chevrolet Silverado 2500 HD LT

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | supplier |
| Bolt Pattern | 8x180 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [tire] Zero tires returned
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
- [package] Package flow not viable: missing wheels or tires

## 🟢 LOW (9)

### 2024 Ford F-150 XLT

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | inventory |
| Bolt Pattern | 6x135 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Chevrolet Silverado 1500 LT

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | inventory |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Ram 1500 Big Horn

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | inventory |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 GMC Sierra 1500 SLT

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | inventory |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Jeep Wrangler Rubicon

| Field | Value |
|-------|-------|
| Category | jeep |
| Failure Type | inventory |
| Bolt Pattern | 5x127 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford F-250 XLT

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | inventory |
| Bolt Pattern | 8x170 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Ram 2500 Big Horn

| Field | Value |
|-------|-------|
| Category | hd |
| Failure Type | inventory |
| Bolt Pattern | 8x165.1 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Toyota Tundra SR5

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | inventory |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires

### 2024 Ford Bronco Wildtrak

| Field | Value |
|-------|-------|
| Category | bronco |
| Failure Type | inventory |
| Bolt Pattern | 6x139.7 ✅ |

**Errors:**
- [low] Package not viable - missing wheel or tire options
- [package] Package flow not viable: missing wheels or tires
