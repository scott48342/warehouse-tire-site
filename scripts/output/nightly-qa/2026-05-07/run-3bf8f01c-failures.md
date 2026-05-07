# QA Failures Report

**Total Failures:** 4 / 25
**Run ID:** `unknown`

---

## 🔴 CRITICAL (2)

### 2024 Mercedes-Benz EQS 450+

| Field | Value |
|-------|-------|
| Category | ev |
| Failure Type | logic |
| Bolt Pattern | 5x114.3 ❌ |

**Errors:**
- [critical] Bolt pattern mismatch: expected 5x112, got 5x114.3
- [wheel] Bolt pattern mismatch: expected 5x112, got 5x114.3

### 2023 Dodge Challenger SRT Hellcat

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Bolt Pattern | 5x115 ✅ |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly

## 🟡 MEDIUM (2)

### 2024 Jeep Gladiator Sport

| Field | Value |
|-------|-------|
| Category | midsize |
| Failure Type | supplier |
| Bolt Pattern | 5x127 ✅ |

**Errors:**
- [medium] Tire search returned no results
- [lift-8] Tire diameter 29" outside expected band 30-42" for 8" lift

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
