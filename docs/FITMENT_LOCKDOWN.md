# Fitment Database Lockdown

## Overview

The fitment database is now **read-only by default**. All future changes must go through a staging + certification + promotion workflow.

## Protection Layers

### 1. Locked Records
All certified records have `is_locked = TRUE`. The app queries use a read-only view that only returns locked, certified records.

### 2. Read-Only View
```sql
-- App queries use this view (cannot INSERT/UPDATE/DELETE)
SELECT * FROM certified_vehicle_fitments
WHERE year = 2024 AND make = 'Toyota' AND model = 'Camry'
```

### 3. Staging Table
New/updated fitments go to `vehicle_fitments_staging`, not the live table.

### 4. Audit Trail
All changes are logged in `fitment_change_log` with:
- Old/new data snapshots
- Source script and version
- Reason for change
- Who performed it
- Batch tracking

### 5. Dataset Versioning
Each certified dataset has a version number (e.g., `v1.0.0-initial`).
New updates create a new version.

## Database Tables

| Table | Purpose |
|-------|---------|
| `vehicle_fitments` | Live production data (locked) |
| `certified_vehicle_fitments` | Read-only view for app |
| `vehicle_fitments_staging` | Staging area for imports |
| `fitment_change_log` | Audit trail |
| `fitment_dataset_versions` | Version tracking |

## Workflow: Adding/Updating Fitments

### Step 1: Stage Records
```typescript
import { stageFitment, stageFitmentBatch } from '@/lib/fitment/lockdown';

const batchId = crypto.randomUUID();

await stageFitment(pool, {
  year: 2025,
  make: 'Toyota',
  model: 'Camry',
  boltPattern: '5x114.3',
  oemWheelSizes: [...],
  oemTireSizes: [...],
  sourceScript: 'import-2025-toyota.ts',
  sourceVersion: 'v1.0.0',
}, batchId);
```

### Step 2: Run Certification
```typescript
import { runCertification } from '@/lib/certification/runner';

// Certify staged records
await runCertification({
  pool,
  table: 'vehicle_fitments_staging',
  batchId,
});
```

### Step 3: Promote to Production
```typescript
import { promoteStagedRecords, createDatasetVersion } from '@/lib/fitment/lockdown';

// Create new version
await createDatasetVersion(pool, 'v1.1.0', '2025 Toyota models', 'admin');

// Promote certified staged records
const result = await promoteStagedRecords(
  pool,
  batchId,
  'admin',
  'v1.1.0',
  'Adding 2025 Toyota Camry fitments'
);

// Activate the new version
await activateDatasetVersion(pool, 'v1.1.0', 'admin');
```

## App Code Changes

### Before (Direct Query - BAD)
```typescript
// ❌ DO NOT USE - can return uncertified data
const { rows } = await pool.query(`
  SELECT * FROM vehicle_fitments 
  WHERE year = $1 AND make = $2 AND model = $3
`, [year, make, model]);
```

### After (Lockdown API - GOOD)
```typescript
// ✅ USE THIS - only returns certified, locked records
import { getCertifiedFitment } from '@/lib/fitment/lockdown';

const fitment = await getCertifiedFitment(pool, year, make, model);
```

Or use the view directly:
```typescript
// ✅ Also safe - view only returns certified records
const { rows } = await pool.query(`
  SELECT * FROM certified_vehicle_fitments
  WHERE year = $1 AND make = $2 AND model = $3
`, [year, make, model]);
```

## CLI Commands

```bash
# Apply lockdown schema
npx tsx scripts/lockdown/apply-fitment-lockdown.ts

# Check lockdown status
curl localhost:3001/api/admin/fitment/lockdown
```

## Admin API

### GET /api/admin/fitment/lockdown
Returns:
- Lockdown status (how many records locked)
- Active dataset version
- Version history
- Staging queue status
- Recent changes

## Columns Added

| Column | Type | Purpose |
|--------|------|---------|
| `is_locked` | BOOLEAN | Prevents modification |
| `dataset_version` | VARCHAR(50) | Version tracking |
| `last_modified_by` | VARCHAR(100) | Who changed it |
| `last_modified_reason` | TEXT | Why changed |

## Safety Guarantees

1. ✅ **No runtime writes** - App code cannot INSERT/UPDATE/DELETE
2. ✅ **Certification required** - Only certified records can be promoted
3. ✅ **Audit trail** - All changes logged with full context
4. ✅ **Versioning** - Can identify when data was added/changed
5. ✅ **Rollback capability** - Old versions archived, can restore
6. ✅ **No regression** - Existing certified data unchanged
