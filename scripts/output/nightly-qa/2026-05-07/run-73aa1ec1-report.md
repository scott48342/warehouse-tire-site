# QA Sweep Report

**Run ID:** `73aa1ec1`  
**Date:** 2026-05-07T13:16:42.840Z  
**Environment:** https://shop.warehousetiredirect.com  


---

## Summary

| Metric | Value |
|--------|-------|
| Total Vehicles | 25 |
| Passed | 20 |
| Failed | 5 |
| **Pass Rate** | **80%** |

### ⚠️ Attention Required

- 🔴 **3 critical failures** requiring immediate attention

## Results by Category

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| car | 3 | 3 | 0 | ✅ 100% |
| ev | 1 | 1 | 0 | ✅ 100% |
| half-ton | 4 | 3 | 1 | 🔴 75% |
| hd | 3 | 3 | 0 | ✅ 100% |
| jeep | 3 | 2 | 1 | 🔴 67% |
| midsize | 3 | 2 | 1 | 🔴 67% |
| staggered | 4 | 4 | 0 | ✅ 100% |
| suv | 4 | 2 | 2 | 🔴 50% |

## Failures by Type

| Type | Count | Description |
|------|-------|-------------|
| Logic | 3 | Fitment logic bugs |
| Inventory | 0 | Valid fitment, no stock |
| Supplier | 2 | API/feed issues |
| Data Gap | 0 | Missing fitment data |
| Test Harness | 0 | Test expectation errors |

## 🔴 Critical Failures

### 2024 Lexus LX 600

- **Category:** suv
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [wheel] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [lift-6] Tire diameter 29" outside expected band 30-42" for 6" lift

### 2023 Chevrolet Silverado 1500 Trail Boss

- **Category:** half-ton
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 6x139.7, got null
- [wheel] Zero wheels returned

### 2024 Jeep Wrangler 392

- **Category:** jeep
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 5x127, got null
- [wheel] Zero wheels returned
