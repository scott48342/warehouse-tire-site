# Neon Migration Plan

## Executive Summary

Migrate Warehouse Tire Direct from Prisma Postgres to Neon with **zero code changes**.
Only environment variable updates required.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│  App Code (Unchanged)                                   │
│  ┌─────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Drizzle │───▶│ node-pg  │───▶│ Prisma Postgres  │   │
│  │  (ORM)  │    │ (driver) │    │   (hosting)      │   │
│  └─────────┘    └──────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Key Finding:** We do NOT use Prisma ORM. We use Drizzle + node-postgres.
Prisma is only the database host. Any Postgres-compatible host works.

---

## Environment Variables

### Current (Prisma)
```bash
# .env.local (local development)
POSTGRES_URL="postgres://USER:PASS@db.prisma.io:5432/postgres?sslmode=require"

# Vercel (production + preview)
POSTGRES_URL="postgres://USER:PASS@db.prisma.io:5432/postgres?sslmode=require"
```

### Target (Neon)
```bash
# .env.local (local development)
POSTGRES_URL="postgres://USER:PASS@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Vercel (production + preview)
POSTGRES_URL="postgres://USER:PASS@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### Variables Used in Code
| Variable | Used By | Notes |
|----------|---------|-------|
| `POSTGRES_URL` | Primary (Drizzle) | Main connection |
| `DATABASE_URL` | Fallback (legacy) | Only if POSTGRES_URL missing |

---

## Code Files That Connect to DB

All use `POSTGRES_URL` with SSL:
- `src/lib/fitment-db/db.ts` - Main Drizzle connection
- `src/lib/vehicleFitment.ts` - Legacy pg Pool
- Various route.ts files - One-off connections

**No code changes needed.** SSL already configured:
```typescript
ssl: { rejectUnauthorized: false }
```

---

## Database Schema

### Tables (19 total)
| Table | Estimated Rows | Purpose |
|-------|---------------|---------|
| vehicle_fitments | ~50,000 | Core fitment data |
| fitment_source_records | ~50,000 | API response cache |
| modification_aliases | ~10,000 | Trim ID mappings |
| abandoned_carts | ~5,000 | Cart recovery |
| email_subscribers | ~2,000 | Marketing |
| email_campaigns | ~100 | Email campaigns |
| email_campaign_recipients | ~10,000 | Campaign sends |
| email_campaign_events | ~50,000 | Email tracking |
| cart_add_events | ~20,000 | Analytics |
| tire_images | ~5,000 | Image cache |
| km_image_mappings | ~10,000 | K&M images |
| fitment_overrides | ~100 | Manual corrections |
| fitment_import_jobs | ~50 | Import tracking |
| catalog_makes | ~50 | Vehicle makes |
| catalog_models | ~500 | Vehicle models |
| catalog_sync_log | ~100 | Sync tracking |
| vehicle_fitment_configurations | ~0 | (new, unused) |
| competitor_page_analysis | ~100 | Competitor data |
| vehicles/fitments/wheel_specs | Legacy | Old schema |

### PostgreSQL Extensions
- `uuid-ossp` (UUID generation) - Built into Neon
- No custom extensions required

---

## Migration Steps

### Phase 1: Preparation (You)
1. ☐ Create Neon account at https://console.neon.tech
2. ☐ Create project: `warehouse-tire-direct`
3. ☐ Region: `us-east-1` (N. Virginia)
4. ☐ Copy connection string

### Phase 2: Export/Import (Local)
```powershell
cd scripts/neon-migration

# 1. Set Prisma URL
$env:PRISMA_URL = "postgres://...@db.prisma.io:5432/postgres?sslmode=require"

# 2. Export
.\export-prisma.ps1

# 3. Set Neon URL
$env:NEON_URL = "postgres://...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 4. Import
.\import-neon.ps1

# 5. Verify
.\verify-migration.ps1
```

### Phase 3: Local Testing
```powershell
# Update .env.local
# POSTGRES_URL="postgres://...@neon.tech/neondb?sslmode=require"

npm run dev

# Test flows:
# - http://localhost:3001 (homepage)
# - YMM selectors
# - Wheel search
# - Tire search  
# - POS
# - Staggered: 2020 Ford Mustang GT Performance
```

### Phase 4: Preview Testing
1. ☐ Vercel > Project Settings > Environment Variables
2. ☐ Add/Update `POSTGRES_URL` for **Preview** only
3. ☐ Create Preview deployment
4. ☐ Test all critical flows

### Phase 5: Production Cutover
1. ☐ Final data sync (if time gap)
2. ☐ Update `POSTGRES_URL` for **Production**
3. ☐ Trigger Production deployment
4. ☐ Verify live site

---

## Validation Checklist

### Critical Flows
- [ ] Homepage loads
- [ ] YMM year dropdown
- [ ] YMM make dropdown
- [ ] YMM model dropdown
- [ ] YMM trim dropdown
- [ ] Wheel search results
- [ ] Tire search results
- [ ] Wheel PDP
- [ ] Tire PDP
- [ ] Package builder
- [ ] POS vehicle entry
- [ ] POS build type (staggered detection)
- [ ] POS wheel selection
- [ ] POS tire selection
- [ ] Admin fitment search
- [ ] Cart functionality

### Performance
- [ ] YMM selector response < 500ms
- [ ] Fitment search response < 2s
- [ ] No connection errors in logs

---

## Rollback Plan

If issues occur after cutover:

### Immediate (< 5 min)
1. Vercel > Environment Variables
2. Revert `POSTGRES_URL` to Prisma connection string
3. Trigger redeployment

### Data Recovery
- Prisma database remains intact (read-only backup)
- No data loss possible during cutover

---

## Neon Benefits

| Feature | Prisma Postgres | Neon |
|---------|----------------|------|
| Free tier ops | 10M/month | 1B/month |
| Connection pooling | Built-in | Built-in |
| Autoscaling | Yes | Yes |
| Branching | No | Yes |
| Region | us-east | us-east |

---

## Files Created

```
scripts/neon-migration/
├── README.md              # Quick reference
├── MIGRATION-PLAN.md      # This document
├── export-prisma.ps1      # Export script
├── import-neon.ps1        # Import script
└── verify-migration.ps1   # Verification script
```

---

## Go/No-Go Criteria

### GO if:
- All tables migrated with matching row counts
- All critical flows pass testing
- No connection errors in 30-minute test period
- Response times comparable to Prisma

### NO-GO if:
- Any table missing or empty
- Critical flow failures
- Connection instability
- Significant performance degradation (>2x slower)
