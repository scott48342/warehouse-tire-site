# Neon Migration Scripts

## Overview

These scripts migrate the Warehouse Tire Direct database from Prisma Postgres to Neon.

## Prerequisites

1. Neon account created at https://neon.tech
2. `psql` and `pg_dump` installed locally
3. Access to current Prisma Postgres credentials

## Migration Steps

### 1. Create Neon Database

1. Go to https://console.neon.tech
2. Create new project: `warehouse-tire-direct`
3. Select region: `us-east-1` (closest to current Prisma region)
4. Copy the connection string

### 2. Export from Prisma Postgres

```powershell
# Set Prisma connection string
$env:PRISMA_URL = "postgres://USER:PASS@db.prisma.io:5432/postgres?sslmode=require"

# Run export
.\export-prisma.ps1
```

This creates `prisma-export-YYYY-MM-DD.sql`

### 3. Import to Neon

```powershell
# Set Neon connection string
$env:NEON_URL = "postgres://USER:PASS@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Run import
.\import-neon.ps1
```

### 4. Verify

```powershell
# Compare table counts
.\verify-migration.ps1
```

### 5. Update Environment Variables

Local (.env.local):
```
POSTGRES_URL="postgres://...@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

Vercel:
- Go to Project Settings > Environment Variables
- Update `POSTGRES_URL` for Preview environment first
- Test Preview deployment
- Update Production after validation

## Rollback

To rollback, simply revert `POSTGRES_URL` to the Prisma connection string.

## Connection String Format

**Prisma Postgres:**
```
postgres://USER:PASS@db.prisma.io:5432/postgres?sslmode=require
```

**Neon:**
```
postgres://USER:PASS@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## SSL Notes

Both Prisma and Neon require SSL. The app already handles this:
```typescript
ssl: { rejectUnauthorized: false }
```

No code changes needed.
