# QA Failures Report

**Total Failures:** 5 / 25
**Run ID:** `unknown`

---

## 🔴 CRITICAL (3)

### 2024 Lexus LX 600

| Field | Value |
|-------|-------|
| Category | suv |
| Failure Type | logic |
| Bolt Pattern | 5x150 ❌ |

**Errors:**
- [critical] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [wheel] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [lift-6] Tire diameter 29" outside expected band 30-42" for 6" lift
- [lift-8] Tire diameter 29" outside expected band 30-44" for 8" lift

### 2023 Chevrolet Silverado 1500 Trail Boss

| Field | Value |
|-------|-------|
| Category | half-ton |
| Failure Type | logic |

**Errors:**
- [critical] Bolt pattern mismatch: expected 6x139.7, got null
- [wheel] Zero wheels returned

### 2024 Jeep Wrangler 392

| Field | Value |
|-------|-------|
| Category | jeep |
| Failure Type | logic |

**Errors:**
- [critical] Bolt pattern mismatch: expected 5x127, got null
- [wheel] Zero wheels returned

## 🟡 MEDIUM (2)

### 2024 Lincoln Navigator Reserve

| Field | Value |
|-------|-------|
| Category | suv |
| Failure Type | supplier |
| Bolt Pattern | 6x135 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [lift-6] Tire diameter 29" outside expected band 30-42" for 6" lift
- [lift-8] Tire diameter 29" outside expected band 30-44" for 8" lift

### 2024 Jeep Gladiator Sport

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | supplier |
| Bolt Pattern | 5x127 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [lift-8] Tire diameter 29" outside expected band 30-42" for 8" lift
