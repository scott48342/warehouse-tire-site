# Issue: Trim Normalization / Fuzzy Lookup Mismatch

**Status:** ✅ RESOLVED  
**Priority:** Medium  
**Created:** 2026-05-06  
**Resolved:** 2026-05-06  
**Commit:** `8a3de86`  
**Regression Risk:** HIGH — affects canonical resolver (VERIFIED NO REGRESSION)  

---

## Problem

Trim lookup fails for punctuation/special character variants.

**Example failure:**
- Input: `trim=R/T Scat Pack Widebody`
- Expected match: `modification_id=rt-scat-pack-widebody`
- Actual: No match (lookup fails)

**Root cause:** Punctuation/slash normalization does not transform `R/T` → `rt` during lookup.

---

## Scope: Audit Required

Audit trim normalization for these patterns:

| Pattern | Example Trims | Normalization Expected |
|---------|---------------|------------------------|
| Slash | R/T, R/T Scat Pack | `R/T` → `rt` |
| Space in name | 1LE, ZL1, GT500 | Already works? Verify |
| Numeric prefix | M440i, 340i | Preserve digits |
| Space in badge | C 63, E 63 | `C 63` → `c63` |
| AMG variants | AMG GT, AMG C 63 | `AMG C 63` → `amg-c-63` or `amg-c63`? |
| Compound badges | xDrive, 4MATIC | Case normalization |
| TRD variants | TRD Off-Road, TRD Pro | Hyphenation rules |

---

## Deliverables Required Before Fix

### 1. Affected Trims Report
- Query DB for all trims containing: `/`, spaces in badges, AMG, xDrive, 4MATIC, TRD
- List which currently resolve vs. fail
- Count affected vehicles

### 2. Normalization Rules Specification
- Document exact transformation rules
- Handle edge cases (e.g., `M440i xDrive` vs `M440i`)
- Ensure bidirectional consistency (trim → mod_id → trim)

### 3. Safe Implementation Plan
- Normalize at query time only (don't alter stored data)
- Add normalization layer before fuzzy match
- Preserve original trim in response

### 4. Required Tests
- Unit tests for each normalization pattern
- Integration tests: trim → modification_id lookup
- Regression tests: ensure existing lookups don't break
- Specific test cases:
  ```
  "R/T Scat Pack Widebody" → rt-scat-pack-widebody ✓
  "SRT Hellcat" → srt-hellcat ✓ (baseline)
  "1LE" → 1le ✓
  "ZL1 1LE" → zl1-1le ✓
  "GT500" → gt500 ✓
  "M440i xDrive" → m440i-xdrive ✓
  "C 63" → c-63 OR c63 (decide)
  "AMG GT" → amg-gt ✓
  "4MATIC" → 4matic ✓
  "TRD Off-Road" → trd-off-road ✓
  ```

---

## Files Likely Affected

```
src/lib/fitment-db/profileService.ts   # Main lookup logic
src/lib/fitment-db/fitmentCache.ts     # Cache key generation
src/app/api/wheels/fitment-search/route.ts  # API entry point
```

---

## Constraints

⚠️ **DO NOT:**
- Alter `profileService.ts` canonical resolver without approved plan
- Change stored modification_id format in DB
- Deploy any normalization changes without full test coverage

✅ **ALLOWED:**
- Audit scripts (read-only)
- Test file creation
- Documentation updates

---

## Next Steps

1. [ ] Run audit script to identify all affected trims in DB
2. [ ] Document current normalization behavior
3. [ ] Propose normalization rules for review
4. [ ] Write test cases (without implementation)
5. [ ] Review plan with Scott before any code changes

---

## ✅ Resolution (2026-05-06)

### Root Cause
`isGroupedTrim()` and `splitGroupedTrim()` in `canonicalResolver.ts` were treating ALL `/` as delimiters, splitting `R/T` into `['R', 'T']`.

### Fix Applied
Changed to only split on ` / ` (slash with spaces):
```typescript
// BEFORE (broken)
function isGroupedTrim(displayTrim: string): boolean {
  return /[,\/]/.test(displayTrim);  // Matches R/T!
}

// AFTER (fixed)
function isGroupedTrim(displayTrim: string): boolean {
  if (displayTrim.includes(',')) return true;
  if (/ \/ /.test(displayTrim)) return true;  // Only spaced slash
  return false;
}
```

### Validation
- 17/17 unit tests pass
- Production trims API: R/T displays correctly
- Production fitment-search: R/T resolves to `directCanonical`
- No regression on grouped trims like `SXT / SXT Plus`

---

## References

- Challenger Hellcat fix: `scripts/delete-bad-tier-a-records.mjs`
- Profile service: `src/lib/fitment-db/profileService.ts`
- Related: Tier A trim list in `TOOLS.md`
