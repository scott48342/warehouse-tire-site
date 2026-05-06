# QA Sweep Report

**Run ID:** `30b384b9`  
**Date:** 2026-05-06T15:15:52.059Z  
**Environment:** https://shop.warehousetiredirect.com  


---

## Summary

| Metric | Value |
|--------|-------|
| Total Vehicles | 50 |
| Passed | 0 |
| Failed | 50 |
| **Pass Rate** | **0%** |

### ⚠️ Attention Required

- 🔴 **11 critical failures** requiring immediate attention
- 🟠 **17 high-severity failures**

## Results by Category

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| bronco | 1 | 0 | 1 | 🔴 0% |
| car | 8 | 0 | 8 | 🔴 0% |
| ev | 4 | 0 | 4 | 🔴 0% |
| half-ton | 7 | 0 | 7 | 🔴 0% |
| hd | 6 | 0 | 6 | 🔴 0% |
| jeep | 3 | 0 | 3 | 🔴 0% |
| midsize | 7 | 0 | 7 | 🔴 0% |
| staggered | 9 | 0 | 9 | 🔴 0% |
| suv | 5 | 0 | 5 | 🔴 0% |

## Failures by Type

| Type | Count | Description |
|------|-------|-------------|
| Logic | 28 | Fitment logic bugs |
| Inventory | 3 | Valid fitment, no stock |
| Supplier | 19 | API/feed issues |
| Data Gap | 0 | Missing fitment data |
| Test Harness | 0 | Test expectation errors |

## 🔴 Critical Failures

### 2024 Ford Mustang GT

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false

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

### 2024 Dodge Challenger R/T

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [tire] Zero tires returned

### 2023 Chevrolet Corvette Stingray

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [tire] Zero tires returned
- [staggered] Staggered mismatch: expected=true, detected=false

### 2024 Lexus LX 600

- **Category:** suv
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [wheel] Bolt pattern mismatch: expected 6x139.7, got 5x150
- [tire] Zero tires returned

### 2018 Ram 1500 Express

- **Category:** half-ton
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 6x139.7, got 5x139.7
- [wheel] Bolt pattern mismatch: expected 6x139.7, got 5x139.7
- [lift-4] Tire diameter 32" outside expected band 33-35" for 4" lift

### 2023 Dodge Challenger Hellcat

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [tire] Zero tires returned

### 2024 BMW M3 Competition

- **Category:** staggered
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 5x112, got null
- [wheel] Zero wheels returned
- [tire] Zero tires returned

### 2018 Jeep Wrangler JK Unlimited

- **Category:** jeep
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 5x127, got null
- [wheel] Zero wheels returned
- [tire] Zero tires returned
