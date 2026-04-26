# Fitment Certification System

## Overview

The certification system ensures that all vehicle fitment data meets quality standards before being served to customers. **No uncertified data can silently enter the live pool.**

## Status Values

| Status | Meaning |
|--------|---------|
| `certified` | Passed all validation rules, safe for customer use |
| `needs_review` | Failed validation, excluded from live flows |
| `quarantined` | Manually flagged for investigation |

## Database Columns

```sql
certification_status          -- certified | needs_review | quarantined
certification_errors          -- JSONB array of {type, message, details}
certified_at                  -- Timestamp when certified
certified_by_script_version   -- Version stamp of certifying script
quarantined_at                -- Timestamp when quarantined
audit_original_data           -- JSONB snapshot of original data before corrections
```

## Validation Rules

| Rule | Error Type | Description |
|------|-----------|-------------|
| Bolt pattern required | `MISSING_BOLT_PATTERN` | Must have valid bolt pattern |
| Wheel sizes required | `MISSING_WHEEL_SIZES` | Must have at least one wheel size |
| Tire sizes required | `MISSING_TIRE_SIZES` | Must have at least one tire size |
| Diameter match | `DATA_MISMATCH` | Tire diameters must match wheel diameters |
| Wheel spread | `WHEEL_SPREAD` | Max 6" diameter range for OEM |
| Wheel soup | `WHEEL_SOUP` | Max 8 stock wheel options |
| Tire soup | `TIRE_SOUP` | Max 10 tire options |
| Era appropriate | `MODERN_TIRES_ON_CLASSIC` | No R19+ on pre-1985 vehicles |
| Aftermarket | `AFTERMARKET_WHEEL` | Wheels must be era-appropriate |

## Usage

### For Import Scripts

```typescript
import { certifyOnUpdate, certifyBatch, withCertification } from '@/lib/certification';

// Option 1: Certify after each insert
const id = await insertFitment(data);
await certifyOnUpdate(pool, id);

// Option 2: Certify batch after bulk import
const ids = await bulkInsertFitments(data);
await certifyBatch(pool, ids);

// Option 3: Use wrapper (recommended)
await withCertification(pool, async (certify) => {
  for (const record of records) {
    const id = await insertFitment(record);
    certify(id); // Queue for certification
  }
});
// Certification runs automatically after wrapper completes
```

### Pre-validation

```typescript
import { validateBeforeInsert } from '@/lib/certification';

const errors = validateBeforeInsert({
  year: 2022,
  make: 'Toyota',
  model: 'Camry',
  bolt_pattern: '5x114.3',
  oem_wheel_sizes: [...],
  oem_tire_sizes: [...],
});

if (errors.length > 0) {
  console.log('Would fail certification:', errors);
}
```

### CLI Runner

```bash
# Show current status
npx tsx scripts/run-fitment-certification.ts --report

# Re-certify all needs_review records
npx tsx scripts/run-fitment-certification.ts --verbose

# Dry run (no changes)
npx tsx scripts/run-fitment-certification.ts --dry-run

# Re-certify ALL records (use with caution)
npx tsx scripts/run-fitment-certification.ts --all
```

### Admin API

```
GET /api/admin/certification/status
```

Returns:
- Current totals (certified, needs_review, quarantined)
- Error type breakdown
- Top offender families
- Recent needs_review records

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0-initial | 2026-04-26 | Initial certified pool (99.5%) |
| v1.1.0 | 2026-04-26 | Operationalized certification system |

## Critical Rules

1. **ALL import scripts MUST call certification** after modifying fitment data
2. **Certification failures go to needs_review**, not live pool
3. **Audit trail is preserved** in `audit_original_data`
4. **Version stamps** enable tracking certification over time

## Files

```
src/lib/certification/
├── index.ts        # Central export
├── types.ts        # Type definitions
├── rules.ts        # Validation rules (single source of truth)
├── runner.ts       # Batch certification runner
└── guard.ts        # Import/update guards

scripts/
├── run-fitment-certification.ts    # CLI runner
└── certification/
    └── apply-certification-infra.ts # One-time setup

src/app/api/admin/certification/
└── status/route.ts  # Admin status API
```
