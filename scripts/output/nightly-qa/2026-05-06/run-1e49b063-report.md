# QA Sweep Report

**Run ID:** `1e49b063`  
**Date:** 2026-05-06T15:30:57.979Z  
**Environment:** http://localhost:3000  


---

## Summary

| Metric | Value |
|--------|-------|
| Total Vehicles | 15 |
| Passed | 14 |
| Failed | 1 |
| **Pass Rate** | **93%** |

### ⚠️ Attention Required

- 🔴 **1 critical failures** requiring immediate attention

## Results by Category

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| car | 1 | 1 | 0 | ✅ 100% |
| ev | 1 | 1 | 0 | ✅ 100% |
| half-ton | 4 | 4 | 0 | ✅ 100% |
| hd | 3 | 3 | 0 | ✅ 100% |
| midsize | 4 | 4 | 0 | ✅ 100% |
| staggered | 1 | 0 | 1 | 🔴 0% |
| suv | 1 | 1 | 0 | ✅ 100% |

## Failures by Type

| Type | Count | Description |
|------|-------|-------------|
| Logic | 1 | Fitment logic bugs |
| Inventory | 0 | Valid fitment, no stock |
| Supplier | 0 | API/feed issues |
| Data Gap | 0 | Missing fitment data |
| Test Harness | 0 | Test expectation errors |

## 🔴 Critical Failures

### 2023 Dodge Challenger Hellcat

- **Category:** staggered
- **Failure Type:** logic
- [critical] Staggered vehicle not detected as staggered (expected=true, detected=false)
- [wheel] Zero wheels returned
- [staggered] Staggered mismatch: expected=true, detected=false
