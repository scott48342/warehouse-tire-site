# Fitment Discovery & Promotion Pipeline

Safe pipeline for discovering, validating, and promoting new model year fitment data.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   DISCOVERY     │────▶│   VALIDATION    │────▶│   PROMOTION     │
│   (Weekly)      │     │   (Weekly)      │     │   (Manual/Cron) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ fitment_staging │     │ staging_audit   │     │vehicle_fitments │
│ (status:pending)│     │ (check results) │     │ (production)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Tables

### fitment_staging
Quarantine for newly discovered fitment records. Records progress through statuses:
- `pending` → Awaiting validation
- `validated` → Passed all checks, ready for promotion
- `flagged` → Failed validation, needs review
- `promoted` → Successfully moved to production
- `rejected` → Manually rejected after review

### fitment_staging_audit
Detailed validation results for each staged record. Tracks:
- Which checks passed/failed
- Error/warning severity
- Validation messages

### fitment_change_log
Complete history of all pipeline actions:
- Discovery events
- Validation results
- Promotions
- Rejections

### fitment_pipeline_runs
Execution history for monitoring:
- Run timing and duration
- Record counts per stage
- Error tracking

## Validation Checks

1. **required_fields** - Year, make, model must be present
2. **wheel_specs** - Valid OEM wheel sizes with diameter/width
3. **tire_specs** - Valid tire size format
4. **bolt_pattern** - Expected pattern for make
5. **center_bore** - Within typical range (54-131mm)
6. **offset_range** - Not too broad (≤40mm spread)
7. **generation_boundary** - Within known platform generation

## Promotion Rules

Records are only promoted when:
- ✅ `status = 'validated'`
- ✅ `confidence IN ('high', 'medium')`
- ✅ No existing production record
- ✅ All required fields present

Records stay flagged for review if:
- ❌ Any error-severity check failed
- ❌ Low confidence score
- ⚠️ Multiple warnings

## Commands

### Discovery
```bash
# Discover new 2027 fitment data
npx tsx scripts/fitment-pipeline/run-pipeline.ts discover --year 2027
```

### Validation
```bash
# Validate all pending staged records
npx tsx scripts/fitment-pipeline/run-pipeline.ts validate
```

### Promotion
```bash
# Dry-run promotion (shows what would be promoted)
npx tsx scripts/fitment-pipeline/run-pipeline.ts promote --dry-run

# Live promotion to production
npx tsx scripts/fitment-pipeline/run-pipeline.ts promote
```

### Report
```bash
# Generate status report
npx tsx scripts/fitment-pipeline/run-pipeline.ts report
```

## Cron Schedule

### Weekly Pipeline (Sundays 2:00 AM ET)

```cron
# Discovery + Validation (Sunday 2:00 AM)
0 2 * * 0 cd /path/to/warehouse-tire-site && npx tsx scripts/fitment-pipeline/run-pipeline.ts discover --year 2027
0 2 30 * * 0 cd /path/to/warehouse-tire-site && npx tsx scripts/fitment-pipeline/run-pipeline.ts validate

# Report (Sunday 3:00 AM)
0 3 * * 0 cd /path/to/warehouse-tire-site && npx tsx scripts/fitment-pipeline/run-pipeline.ts report
```

### Clawdbot Cron Jobs

Add to Clawdbot Gateway config:
```yaml
cron:
  jobs:
    - id: fitment-discovery
      schedule: "0 2 * * 0"  # Sunday 2:00 AM
      text: "Run fitment discovery pipeline for 2027 model year"
      enabled: true
      
    - id: fitment-validation
      schedule: "30 2 * * 0"  # Sunday 2:30 AM
      text: "Run fitment validation pipeline"
      enabled: true
      
    - id: fitment-report
      schedule: "0 3 * * 0"  # Sunday 3:00 AM
      text: "Generate fitment pipeline report"
      enabled: true
```

## Example Summary Output

```
═══ PIPELINE REPORT ═══

STAGING STATUS:
  pending: 0
  validated: 45
  flagged: 12
  promoted: 238

FLAGGED RECORDS (12):
  2027 chevrolet silverado-1500 "Custom": ["wheel_specs"]
  2027 ford f-150 "XL": ["center_bore", "offset_range"]

RECENT PROMOTIONS (20):
  2027 toyota camry "LE"
  2027 toyota camry "SE"
  2027 honda accord "LX"
  ...

RECENT PIPELINE RUNS:
  discovery (2027) @ 2026-04-14 02:00:00: completed
    Discovered: 156, Validated: 0, Flagged: 0, Promoted: 0
  validation (all) @ 2026-04-14 02:30:00: completed
    Discovered: 0, Validated: 143, Flagged: 13, Promoted: 0
```

## Safety Guarantees

1. **No Auto-Publish** - New data goes to staging, not production
2. **Validation Required** - Every record must pass checks
3. **Audit Trail** - Complete history of all changes
4. **Manual Override** - Flagged records need human review
5. **Dry-Run Support** - Test promotions before applying
6. **Rollback Ready** - Change log enables reversal

## File Structure

```
scripts/fitment-pipeline/
├── run-pipeline.ts        # Main pipeline runner
├── create-staging-tables.sql  # Migration script
├── PIPELINE.md            # This documentation

src/lib/fitment-pipeline/
├── validation-rules.ts    # Validation check implementations

src/lib/fitment-db/
├── staging-schema.ts      # Drizzle schema for staging tables
```
