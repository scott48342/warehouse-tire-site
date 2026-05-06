# QA Sweep Report

**Run ID:** `2b633252`  
**Date:** 2026-05-06T15:25:08.136Z  
**Environment:** https://shop.warehousetiredirect.com  


---

## Summary

| Metric | Value |
|--------|-------|
| Total Vehicles | 20 |
| Passed | 17 |
| Failed | 3 |
| **Pass Rate** | **85%** |

### ⚠️ Attention Required

- 🔴 **3 critical failures** requiring immediate attention

## Results by Category

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| bronco | 1 | 1 | 0 | ✅ 100% |
| half-ton | 5 | 5 | 0 | ✅ 100% |
| hd | 3 | 3 | 0 | ✅ 100% |
| jeep | 1 | 1 | 0 | ✅ 100% |
| midsize | 1 | 1 | 0 | ✅ 100% |
| staggered | 9 | 6 | 3 | 🔴 67% |

## Failures by Type

| Type | Count | Description |
|------|-------|-------------|
| Logic | 3 | Fitment logic bugs |
| Inventory | 0 | Valid fitment, no stock |
| Supplier | 0 | API/feed issues |
| Data Gap | 0 | Missing fitment data |
| Test Harness | 0 | Test expectation errors |

## 🔴 Critical Failures

### 2024 Dodge Challenger R/T

- **Category:** staggered
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 5x115, got null
- [wheel] Zero wheels returned

### 2024 Chevrolet Camaro 1LE

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [staggered] Staggered mismatch: expected=true, detected=false

### 2024 Dodge Challenger Widebody

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [staggered] Staggered mismatch: expected=true, detected=false
