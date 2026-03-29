# Admin Fitment Validation System

**Created:** 2026-03-29

## Overview

Internal validation dashboard for testing real production fitment flows. Validates that vehicles can successfully navigate:

1. **Standard Flow:** Vehicle → Tire Sizes → Wheels → Tires → Packages
2. **Lifted Flow:** Vehicle → Lift Profile → Recommended Tires → Wheels → Packages
3. **Staggered Flow:** Vehicle → Front/Rear Tire Sizes → Wheels → Front Tires + Rear Tires → Package

## Files Created

### Database Schema
```
src/lib/fitment-db/validation/schema.ts       - Drizzle schema for validation tables
drizzle/migrations/0015_validation_tables.sql - SQL migration
```

### Service Layer
```
src/lib/fitment-db/validation/validationService.ts - Core validation logic
src/lib/fitment-db/validation/index.ts             - Module exports
```

### API Routes
```
src/app/api/admin/validation/run/route.ts              - POST: Start new validation run
src/app/api/admin/validation/runs/route.ts             - GET: List all runs
src/app/api/admin/validation/runs/[runId]/route.ts     - GET: Single run with breakdown
src/app/api/admin/validation/results/route.ts          - GET: Paginated results with filters
src/app/api/admin/validation/results/[id]/route.ts     - GET: Single result with diagnostics
src/app/api/admin/validation/rerun/route.ts            - POST: Rerun failed vehicles
src/app/api/admin/validation/export/route.ts           - GET: Export results as CSV
```

### Admin UI
```
src/app/admin/validation/page.tsx - Full validation dashboard
src/app/admin/layout.tsx          - Updated nav with Validation link
```

## Database Tables

### validation_runs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Run name |
| description | TEXT | Optional description |
| filter_year | INTEGER | Year filter used |
| filter_make | VARCHAR(100) | Make filter used |
| filter_model | VARCHAR(100) | Model filter used |
| filter_bolt_pattern | VARCHAR(20) | Bolt pattern filter |
| status | VARCHAR(20) | pending/running/completed/failed |
| total_vehicles | INTEGER | Total tested |
| pass_count | INTEGER | Passed count |
| fail_count | INTEGER | Failed count |
| partial_count | INTEGER | Partial count |
| started_at | TIMESTAMP | Start time |
| completed_at | TIMESTAMP | End time |
| duration_ms | INTEGER | Total duration |
| include_lifted | BOOLEAN | Whether lifted flow tested |
| created_at | TIMESTAMP | Created timestamp |
| created_by | VARCHAR(100) | Who started the run |

### validation_results
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| run_id | UUID | Foreign key to runs |
| year | INTEGER | Vehicle year |
| make | VARCHAR(100) | Vehicle make |
| model | VARCHAR(100) | Vehicle model |
| trim | VARCHAR(255) | Vehicle trim |
| status | VARCHAR(20) | pass/fail/partial |
| standard_tire_size_count | INTEGER | Tire sizes found |
| standard_wheel_count | INTEGER | Wheels found |
| standard_tire_count | INTEGER | Tires found |
| standard_package_count | INTEGER | Packages found |
| standard_bolt_pattern | VARCHAR(20) | Bolt pattern |
| standard_source | VARCHAR(50) | Data source |
| lifted_enabled | BOOLEAN | Lifted flow tested |
| lifted_preset_id | VARCHAR(20) | Lift preset used |
| lifted_wheel_count | INTEGER | Lifted wheels found |
| lifted_tire_count | INTEGER | Lifted tires found |
| staggered_applicable | BOOLEAN | Vehicle has staggered fitment |
| staggered_status | VARCHAR(20) | pass/fail/skipped |
| staggered_front_tire_count | INTEGER | Front tires found |
| staggered_rear_tire_count | INTEGER | Rear tires found |
| staggered_wheel_count | INTEGER | Wheels found |
| staggered_package_count | INTEGER | Staggered packages |
| staggered_front_size | VARCHAR(50) | Front tire size |
| staggered_rear_size | VARCHAR(50) | Rear tire size |
| failure_type | VARCHAR(50) | Failure category |
| failure_reason | TEXT | Human-readable reason |
| diagnostics | JSONB | Full diagnostic data |
| duration_ms | INTEGER | Test duration |
| tested_at | TIMESTAMP | Test timestamp |

## Failure Types

| Type | Description |
|------|-------------|
| `no_tire_sizes` | No tire sizes returned from fitment lookup |
| `no_wheels` | No wheels found for bolt pattern |
| `no_tires` | No tires found for tire sizes |
| `no_packages` | Wheels/tires found but no packages |
| `no_bolt_pattern` | Missing bolt pattern data |
| `api_error` | API call failed |
| `lifted_no_profile` | No lift recommendations for vehicle |
| `lifted_no_wheels` | Standard passed but lifted found no wheels |
| `staggered_fail` | Standard passed but staggered fitment validation failed |
| `staggered_no_front` | No front tires found for staggered size |
| `staggered_no_rear` | No rear tires found for staggered size |

## API Usage

### Start a Validation Run
```bash
POST /api/admin/validation/run
{
  "name": "Dodge Full Validation",
  "make": "Dodge",
  "limit": 100,
  "includeLifted": true
}
```

### Get Run Results
```bash
GET /api/admin/validation/results?runId=xxx&status=fail&limit=50&offset=0
```

### Rerun Failed Vehicles
```bash
POST /api/admin/validation/rerun
{
  "runId": "xxx"
}
```

### Export to CSV
```bash
GET /api/admin/validation/export?runId=xxx
```

## UI Features

1. **Summary Cards** - Pass rate, totals, status at a glance
2. **Failure Breakdown** - Clickable failure type badges for filtering
3. **Status Filters** - Filter by pass/fail/partial
4. **Paginated Table** - Vehicle results with key metrics
5. **Detail Drawer** - Full diagnostics for any vehicle
6. **Rerun Failed** - One-click to retest failed vehicles
7. **CSV Export** - Download results for offline analysis

## Setup Instructions

### 1. Run Migration
```bash
npx drizzle-kit push:pg
# or manually apply: drizzle/migrations/0015_validation_tables.sql
```

### 2. Build and Deploy
```bash
npm run build
npm run start
```

### 3. Access Dashboard
Navigate to `/admin/validation` and log in with admin credentials.

## Test Instructions

### Quick Test (10 vehicles)
1. Go to `/admin/validation`
2. Click "+ New Validation Run"
3. Enter:
   - Name: "Quick Test"
   - Make: "Dodge"
   - Limit: 10
4. Click "Start Run"
5. Wait for completion (~30 seconds)
6. Review results

### Full Make Validation
1. Create run with:
   - Make: "Dodge" (or any make)
   - Limit: 500
2. Review pass rate and failure breakdown
3. Click failure type badges to filter
4. Click any row for full diagnostics
5. Use "Rerun Failed" to retry failures
6. Export CSV for detailed analysis

## Integration Notes

- Uses existing `vehicleFitments` table to get test vehicles
- Calls real production APIs (`/api/vehicles/tire-sizes`, `/api/wheels/fitment-search`, etc.)
- Uses `getLiftRecommendations()` for lifted flow testing
- Preserves all existing DB-first fitment logic
- Does not modify or bypass bolt pattern filtering
- Admin-only access (requires authentication)

---

*Documentation generated 2026-03-29*
