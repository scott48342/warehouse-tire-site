# USAF Fitment Audit Pipeline

## Overview

USAF is used as an **audit and enrichment source** — NOT a replacement for our canonical fitment architecture.

### What USAF provides:
- OEM tire application validation
- Staggered detection source
- Missing fitment discovery
- HD/commercial supplement
- Tire-size enrichment
- Fitment QA/audit layer

### What we preserve:
- Existing fitment engine remains canonical
- No runtime dependency on USAF
- No customer-facing flow changes
- No wheel fitment logic replacement
- No overwrite of trusted DB records without validation

## Directory Structure

```
src/lib/usaf-fitment/
├── types.ts          # Type definitions
├── normalize.ts      # Tire size normalization utilities
├── compare.ts        # Comparison engine
└── index.ts          # Exports

scripts/usaf-audit/
├── audit-fitment.ts  # Main audit script
├── usaf-vehicle-api.ts # GetVehicleOptions API
└── README.md         # This file
```

## Usage

### Run Audit

```bash
# Audit specific vehicle
npx tsx scripts/usaf-audit/audit-fitment.ts --year 2024 --make Ford --model F-150

# Audit with limit
npx tsx scripts/usaf-audit/audit-fitment.ts --year 2024 --limit 50

# Save results to file
npx tsx scripts/usaf-audit/audit-fitment.ts --year 2024 --output audit-results.json

# Verbose mode
npx tsx scripts/usaf-audit/audit-fitment.ts --year 2024 --verbose
```

### Options

| Option | Description |
|--------|-------------|
| `--year <year>` | Filter by year |
| `--make <make>` | Filter by make |
| `--model <model>` | Filter by model |
| `--limit <n>` | Max vehicles to audit |
| `--output <file>` | Save JSON results |
| `--verbose, -v` | Detailed output |

## Discrepancy Types

| Type | Description | Auto-Enrich? |
|------|-------------|--------------|
| `SAFE_MATCH` | Full match | N/A |
| `MISSING_SIZE` | We're missing a size USAF has | ✅ Yes |
| `POSSIBLE_STAGGERED` | USAF shows staggered, we don't | ✅ Yes |
| `LOAD_RANGE_MISMATCH` | Load range differs | ✅ Yes |
| `SPEED_RATING_MISMATCH` | Speed rating differs | ✅ Yes |
| `EXTRA_USAF_CONFIG` | USAF has extra configs | ⚠️ Review |
| `MISSING_IN_USAF` | We have it, USAF doesn't | ❌ Ignore |
| `POSSIBLE_BAD_DB_RECORD` | Our record looks wrong | ⚠️ Review |
| `WHEEL_DIAMETER_MISMATCH` | Wheel diameters differ | ⚠️ Review |

## Safe Enrichment Rules

### ✅ Can Auto-Enrich (with approval):
- Missing OEM tire sizes
- Staggered detection
- Missing wheel diameters
- Missing speed ratings
- Missing load indexes

### ❌ NEVER Auto-Overwrite:
- Bolt pattern
- Offsets
- Center bore
- Wheel widths
- Canonical trim IDs

## TODO

- [ ] Confirm GetVehicleOptions SOAP structure
- [ ] Build admin review interface
- [ ] Add batch processing for large audits
- [ ] Implement safe enrichment with approval queue
