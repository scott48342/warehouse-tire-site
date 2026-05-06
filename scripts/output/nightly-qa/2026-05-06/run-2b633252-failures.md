# QA Failures Report

**Total Failures:** 3 / 20
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

### 2024 Chevrolet Camaro 1LE

| Field | Value |
|-------|-------|
| Category | staggered |
| Failure Type | logic |
| Staggered | Expected: true, Got: false ❌ |

**Errors:**
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
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
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly
