# QA Sweep Report

**Run ID:** `3bf8f01c`  
**Date:** 2026-05-07T13:32:39.730Z  
**Environment:** https://shop.warehousetiredirect.com  


---

## Summary

| Metric | Value |
|--------|-------|
| Total Vehicles | 25 |
| Passed | 21 |
| Failed | 4 |
| **Pass Rate** | **84%** |

### ⚠️ Attention Required

- 🔴 **2 critical failures** requiring immediate attention

## Results by Category

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| car | 2 | 2 | 0 | ✅ 100% |
| ev | 2 | 1 | 1 | 🔴 50% |
| half-ton | 6 | 6 | 0 | ✅ 100% |
| hd | 3 | 3 | 0 | ✅ 100% |
| jeep | 2 | 2 | 0 | ✅ 100% |
| midsize | 5 | 4 | 1 | 🟡 80% |
| staggered | 4 | 3 | 1 | 🔴 75% |
| suv | 1 | 0 | 1 | 🔴 0% |

## Failures by Type

| Type | Count | Description |
|------|-------|-------------|
| Logic | 2 | Fitment logic bugs |
| Inventory | 0 | Valid fitment, no stock |
| Supplier | 2 | API/feed issues |
| Data Gap | 0 | Missing fitment data |
| Test Harness | 0 | Test expectation errors |

## 🔴 Critical Failures

### 2024 Mercedes-Benz EQS 450+

- **Category:** ev
- **Failure Type:** logic
- [critical] Bolt pattern mismatch: expected 5x112, got 5x114.3
- [wheel] Bolt pattern mismatch: expected 5x112, got 5x114.3

### 2023 Dodge Challenger SRT Hellcat

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [staggered] Staggered mismatch: expected=true, detected=false
- [staggered] CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly
