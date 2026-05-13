# Wheel Fitment Confidence Remediation Plan
Generated: 2026-05-13

## Executive Summary

**Total flagged: 26 vehicles** (6 LOW + 20 NEEDS_REVIEW)

| Classification | Count | Systemic? |
|----------------|-------|-----------|
| **Staggered Import Artifact** | 5 | ✅ Yes - fix import pipeline |
| **False Positive (Script Bug)** | 8 | ✅ Yes - fix confidence script |
| **WheelPros API Gap** | 9 | ❌ No - external API limitation |
| **Center Lock Wheels** | 1 | ❌ No - edge case, manual |
| **Missing Offset** | 2 | ❌ No - isolated cleanup |
| **HD/Commercial Ambiguity** | 1 | ⚠️ Partially - DRW handling |

**Verdict: 2 systemic issues, rest are isolated cleanup or external API limitations.**

---

## LOW Confidence Vehicles (6)

### 1. 2018 Ferrari 812 Superfast
| Field | Value |
|-------|-------|
| **Score** | 35/100 |
| **Bolt Pattern** | 5x114.3 ✅ |
| **Center Bore** | NULL ❌ |
| **Offset** | NULL ❌ |
| **Tire Sizes** | front: 275/35ZR20, rear: 315/35ZR20 ✅ |
| **Wheel Sizes** | front: 10x20, rear: 11.5x20 ✅ |
| **Source** | tgp_solutions |
| **Root Cause** | **Staggered import artifact** - imported as 2 separate records (Front/Rear) without CB/offset |
| **Fix Type** | `staggered_merge` + `missing_center_bore` + `missing_offset_range` |
| **Recommended Fix** | Merge front/rear records, add CB: 67.0mm, offset: +25 to +45mm (Ferrari spec) |

### 2. 2018 Ferrari GTC4Lusso
| Field | Value |
|-------|-------|
| **Score** | 35/100 |
| **Bolt Pattern** | 5x114.3 ✅ |
| **Center Bore** | NULL ❌ |
| **Offset** | NULL ❌ |
| **Root Cause** | **Staggered import artifact** - same as 812 |
| **Fix Type** | `staggered_merge` + `missing_center_bore` + `missing_offset_range` |
| **Recommended Fix** | Merge, add CB: 67.0mm, offset: +25 to +45mm |

### 3. 2018 Ferrari GTC4Lusso T
| Field | Value |
|-------|-------|
| **Score** | 35/100 |
| **Root Cause** | **Staggered import artifact** - identical to GTC4Lusso |
| **Fix Type** | `staggered_merge` + `missing_center_bore` + `missing_offset_range` |

### 4. 2018 Ford GT
| Field | Value |
|-------|-------|
| **Score** | 35/100 |
| **Bolt Pattern** | 5x114.3 ✅ |
| **Center Bore** | NULL ❌ |
| **Offset** | NULL ❌ |
| **Tire Sizes** | front: 245/35ZR20, rear: 325/30ZR20 ✅ |
| **Root Cause** | **Staggered import artifact** - exotic supercar, same pattern |
| **Fix Type** | `staggered_merge` + `missing_center_bore` + `missing_offset_range` |
| **Recommended Fix** | Merge, add CB: 63.4mm (Ford spec), offset: +30 to +50mm |

### 5. 2018 Lamborghini Aventador
| Field | Value |
|-------|-------|
| **Score** | 45/100 |
| **Bolt Pattern** | NULL (Center Lock) / 5x112 (standard) / 5x120 (rear) ⚠️ |
| **Center Bore** | 57.0mm front / 70.0mm rear ✅ |
| **Offset** | 32mm front / 67mm rear ✅ |
| **Root Cause** | **Center lock wheels** - Aventador has center-lock option with no traditional bolt pattern |
| **Fix Type** | `center_lock_edge_case` |
| **Recommended Fix** | Flag as center-lock in DB, add bolt pattern notation "CENTER_LOCK" or exclude from wheel matching |

### 6. 2018 Mercedes-Benz Sprinter 3500
| Field | Value |
|-------|-------|
| **Score** | 35/100 |
| **Bolt Pattern** | 6x205 (DRW) / 6x130 (SRW) ⚠️ |
| **Center Bore** | NULL or 161.0mm ⚠️ |
| **Offset** | NULL ❌ |
| **Root Cause** | **HD/Commercial DRW** - multiple records with different configs, some incomplete |
| **Fix Type** | `hd_drw_ambiguity` + `missing_offset_range` |
| **Recommended Fix** | Consolidate DRW/SRW records, add CB for 6x205 variant |

---

## NEEDS_REVIEW Vehicles (20)

### Pattern A: BMW 7-Series / Rolls-Royce (9 vehicles)
**Vehicles:** 740e xDrive, 740i, 740i xDrive, 750i, 750i xDrive, Alpina B7, M550i xDrive, Rolls-Royce Phantom

| Field | Value |
|-------|-------|
| **Score** | 70/100 |
| **Bolt Pattern** | 5x112 ✅ |
| **Center Bore** | 72.6mm ✅ |
| **Offset** | 30mm ✅ |
| **Issue** | "Low WheelPros compatibility: 0% hub-safe" |
| **Root Cause** | **WheelPros API Gap** - their search returns 0 hub-safe wheels for 72.6mm CB. This is a WheelPros data/API issue, NOT a WTD data problem. |
| **Fix Type** | `external_api_limitation` - no WTD fix needed |
| **Recommendation** | Update confidence script to not flag as NEEDS_REVIEW when WheelPros returns 0% hub-safe but our data is complete |

### Pattern B: BMW M5 (1 vehicle)
| Field | Value |
|-------|-------|
| **Score** | 50/100 |
| **Bolt Pattern** | 5x112 ✅ |
| **Center Bore** | 72.6mm ✅ |
| **Offset** | NULL ❌ |
| **Root Cause** | **Missing offset** - staggered M5 imported without offset data |
| **Fix Type** | `missing_offset_range` |
| **Recommended Fix** | Add offset: +21 to +35mm (M5 G30 spec) |

### Pattern C: Ford F-450 Super Duty (8 vehicles, 2019-2026)
| Field | Value |
|-------|-------|
| **Score** | 78/100 |
| **Bolt Pattern** | 10x225 ✅ |
| **Center Bore** | 170.1mm ✅ |
| **Offset** | 35-55mm ✅ |
| **Issue** | "Suspicious center bore: 170.1mm" |
| **Root Cause** | **False positive in confidence script** - 170.1mm IS the correct CB for F-450/F-550 commercial chassis. The script flags CB > 150mm as suspicious but HD trucks legitimately have larger hubs. |
| **Fix Type** | `false_positive_script_bug` |
| **Recommended Fix** | Update confidence script to allow CB up to 180mm for HD trucks (8x165, 8x170, 8x180, 8x200, 8x210, 10x225 bolt patterns) |

### Pattern D: GMC Sierra 3500 HD (1 vehicle)
| Field | Value |
|-------|-------|
| **Score** | 65/100 |
| **Issues** | "Suspicious center bore: 154.2mm; Extreme offsets: 137mm" |
| **Root Cause** | **DRW record** - The 154.2mm CB and 137mm offset are for DRW (Dual Rear Wheel) configuration, which is correct. Audit picked up DRW record instead of SRW. |
| **Fix Type** | `hd_drw_ambiguity` |
| **Recommended Fix** | No data fix needed - confidence script should recognize DRW patterns |

### Pattern E: Mercedes Sprinter 3500XD (1 vehicle)
| Field | Value |
|-------|-------|
| **Score** | 50/100 |
| **Issues** | "Suspicious center bore: 161mm; Missing offset range" |
| **Root Cause** | **Commercial DRW** - 161mm CB is correct for commercial Sprinter. Missing offset. |
| **Fix Type** | `hd_drw_ambiguity` + `missing_offset_range` |
| **Recommended Fix** | Add offset range, update script to allow larger CB for commercial |

### Pattern F: Chevrolet Equinox EV (1 vehicle)
| Field | Value |
|-------|-------|
| **Score** | 65/100 |
| **Bolt Pattern** | 6x120 ✅ |
| **Center Bore** | 70.3mm ✅ |
| **Offset** | NULL ❌ |
| **Root Cause** | **Missing offset** - new EV, incomplete import |
| **Fix Type** | `missing_offset_range` + `ev_issue` |
| **Recommended Fix** | Add offset: +45 to +50mm (GM EV platform spec) |

---

## Systemic Issues Identified

### Issue 1: Staggered Import Artifact (SYSTEMIC)
**Affected:** Ferrari 812, GTC4Lusso, GTC4Lusso T, Ford GT, Lamborghini variants
**Problem:** TGP Solutions import creates separate Front/Rear records without merging CB/offset data
**Impact:** 5+ exotic vehicles with LOW confidence
**Fix Required:**
1. Post-import merge script for staggered vehicles
2. Validate CB/offset propagation during import
3. Add to import pipeline validation checks

### Issue 2: False Positive for HD Truck CB (SYSTEMIC)
**Affected:** All F-450 (8 vehicles), Sierra 3500 HD, Sprinter 3500XD
**Problem:** Confidence script flags CB > 150mm as "suspicious" but HD trucks legitimately have 150-180mm CB
**Impact:** 10 vehicles incorrectly flagged as NEEDS_REVIEW
**Fix Required:**
```javascript
// In calculateConfidenceScore():
const isHDTruck = ['8x165', '8x170', '8x180', '8x200', '8x210', '10x225', '6x205'].includes(boltPattern);
const maxValidCB = isHDTruck ? 180 : 150;
if (cb >= 50 && cb <= maxValidCB) {
  scores.centerBore = 20;
}
```

---

## Non-Systemic Issues (Isolated Cleanup)

| Vehicle | Fix Type | Effort |
|---------|----------|--------|
| Lamborghini Aventador | Add CENTER_LOCK flag | Low |
| BMW M5 | Add offset 21-35mm | Low |
| Chevrolet Equinox EV | Add offset 45-50mm | Low |
| Mercedes Sprinter 3500 | Consolidate DRW records | Medium |

---

## WheelPros API Limitations (No WTD Fix)

| Vehicle | Issue |
|---------|-------|
| BMW 740e/740i/750i series | 0% hub-safe returned |
| BMW Alpina B7 | 0% hub-safe returned |
| Rolls-Royce Phantom | 0% hub-safe returned |

**Note:** These vehicles have COMPLETE and CORRECT data in WTD. The WheelPros API returns 0 hub-centric wheels for their specs, which is their limitation, not ours.

---

## Recommended Action Plan

### Phase 1: Fix Confidence Script (Immediate)
1. ✅ Update CB validation to allow up to 180mm for HD trucks
2. ✅ Don't flag NEEDS_REVIEW when WheelPros returns 0% but data is complete
3. ✅ Add HD truck bolt pattern recognition

### Phase 2: Data Cleanup (This Week)
1. Add missing offsets: M5, Equinox EV
2. Merge staggered front/rear records for exotics
3. Add CB/offset for Ferrari/Ford GT

### Phase 3: Import Pipeline Improvement (Future)
1. Add post-import validation for staggered vehicles
2. Ensure CB/offset propagation during TGP imports
3. Add CENTER_LOCK handling for exotic vehicles

---

## Files
- `REMEDIATION-PLAN.md` - This document
- `analyze-low-confidence.mjs` - Investigation script
- `batch-01.json` through `batch-08.json` - Raw audit data
