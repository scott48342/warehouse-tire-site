# Tire Data Cleanup Scripts

Generated: 2026-04-21  
Based on: 161-batch validation against tiresize.com

## Execution Order

Run these scripts in order against your Postgres database:

```bash
# Connect to your database
# Option 1: Using psql
psql $POSTGRES_URL

# Option 2: Using Prisma Studio
npx prisma studio

# Option 3: Using any Postgres client with POSTGRES_URL from .env.local
```

### Step 1: Delete Phantom Years
```sql
\i 01-delete-phantom-years.sql
```
Removes vehicles listed for model years that don't exist (e.g., Beetle 2020-2024, WRX STI 2022+).

**Expected impact:** ~200 records deleted

### Step 2: Delete Non-US Vehicles  
```sql
\i 02-delete-non-us-vehicles.sql
```
Removes JDM, China, Europe-only models never sold in the US.

**Expected impact:** ~500 records deleted

### Step 3: Fix Wrong Tire Sizes
```sql
\i 03-fix-tire-sizes.sql
```
Corrects tire sizes based on OEM validation (width, aspect ratio, diameter errors).

**Expected impact:** ~400 records updated

### Step 4: Populate Empty Records
```sql
\i 04-populate-empty-records.sql
```
Fills in tire sizes for vehicles with empty arrays.

**Expected impact:** ~300 records populated

### Step 5: Validate Cleanup
```sql
\i 05-validate-cleanup.sql
```
Runs validation queries to verify data quality post-cleanup.

## Quick Run (All Scripts)

```bash
cd scripts/tire-validation/cleanup-scripts

# Dry run - just see what would change
psql $POSTGRES_URL -f 01-delete-phantom-years.sql --echo-queries
psql $POSTGRES_URL -f 02-delete-non-us-vehicles.sql --echo-queries

# Execute all
psql $POSTGRES_URL -f 01-delete-phantom-years.sql
psql $POSTGRES_URL -f 02-delete-non-us-vehicles.sql
psql $POSTGRES_URL -f 03-fix-tire-sizes.sql
psql $POSTGRES_URL -f 04-populate-empty-records.sql
psql $POSTGRES_URL -f 05-validate-cleanup.sql
```

## Rollback

All scripts use transactions (`BEGIN`/`COMMIT`). If something goes wrong:

1. The transaction will auto-rollback on error
2. For manual rollback during testing, use `ROLLBACK` instead of `COMMIT`
3. **Recommended:** Take a database backup before running in production

```bash
# Backup before running
pg_dump $POSTGRES_URL > backup-before-tire-cleanup-$(date +%Y%m%d).sql
```

## Files

| File | Purpose |
|------|---------|
| `01-delete-phantom-years.sql` | Remove vehicles with invalid model years |
| `02-delete-non-us-vehicles.sql` | Remove non-US market vehicles |
| `03-fix-tire-sizes.sql` | Correct wrong tire sizes |
| `04-populate-empty-records.sql` | Fill empty tire size arrays |
| `05-validate-cleanup.sql` | Verify cleanup results |

## Post-Cleanup

After running all scripts:

1. Clear the tire cache: `node scripts/clear-tire-cache.js`
2. Verify site functionality: Test vehicle selector flow
3. Spot-check key vehicles: Corolla, Camry, F-150, etc.

## Source Data

- Validation results: `scripts/tire-validation/results/batch-*.json`
- Full audit report: `docs/TIRE-DATA-AUDIT-REPORT.md`
