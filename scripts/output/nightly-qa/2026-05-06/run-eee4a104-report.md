# QA Sweep Report

**Run ID:** `eee4a104`  
**Date:** 2026-05-06T15:19:08.331Z  
**Environment:** https://shop.warehousetiredirect.com  


---

## Summary

| Metric | Value |
|--------|-------|
| Total Vehicles | 20 |
| Passed | 0 |
| Failed | 20 |
| **Pass Rate** | **0%** |

### ⚠️ Attention Required

- 🔴 **3 critical failures** requiring immediate attention

## Results by Category

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| bronco | 1 | 0 | 1 | 🔴 0% |
| half-ton | 5 | 0 | 5 | 🔴 0% |
| hd | 3 | 0 | 3 | 🔴 0% |
| jeep | 1 | 0 | 1 | 🔴 0% |
| midsize | 1 | 0 | 1 | 🔴 0% |
| staggered | 9 | 0 | 9 | 🔴 0% |

## Failures by Type

| Type | Count | Description |
|------|-------|-------------|
| Logic | 3 | Fitment logic bugs |
| Inventory | 9 | Valid fitment, no stock |
| Supplier | 8 | API/feed issues |
| Data Gap | 0 | Missing fitment data |
| Test Harness | 0 | Test expectation errors |

## 🔴 Critical Failures

### 2024 Dodge Challenger R/T

- **Category:** staggered
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 5x115, got null
- [wheel] Zero wheels returned
- [tire] Zero tires returned

### 2024 Chevrolet Camaro 1LE

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [tire] Zero tires returned

### 2024 Dodge Challenger Widebody

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [tire] Zero tires returned
