# QA Sweep Report

**Run ID:** `56eb9dfe`  
**Date:** 2026-05-06T15:17:49.138Z  
**Environment:** https://shop.warehousetiredirect.com  


---

## Summary

| Metric | Value |
|--------|-------|
| Total Vehicles | 15 |
| Passed | 0 |
| Failed | 15 |
| **Pass Rate** | **0%** |

### ⚠️ Attention Required

- 🔴 **8 critical failures** requiring immediate attention
- 🟠 **4 high-severity failures**

## Results by Category

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| half-ton | 4 | 0 | 4 | 🔴 0% |
| hd | 1 | 0 | 1 | 🔴 0% |
| jeep | 1 | 0 | 1 | 🔴 0% |
| staggered | 9 | 0 | 9 | 🔴 0% |

## Failures by Type

| Type | Count | Description |
|------|-------|-------------|
| Logic | 12 | Fitment logic bugs |
| Inventory | 2 | Valid fitment, no stock |
| Supplier | 1 | API/feed issues |
| Data Gap | 0 | Missing fitment data |
| Test Harness | 0 | Test expectation errors |

## 🔴 Critical Failures

### 2023 Ford Mustang GT Performance Pack

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false

### 2024 Chevrolet Camaro SS

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false

### 2023 Chevrolet Camaro ZL1

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false

### 2023 Chevrolet Corvette Stingray

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false

### 2024 Dodge Challenger R/T

- **Category:** staggered
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 5x115, got null
- [wheel] Zero wheels returned
- [tire] Zero tires returned

### 2024 Ford Mustang Dark Horse

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false

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
