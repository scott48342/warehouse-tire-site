# FITMENT CHANGE CONTROL

> **🔒 FITMENT FREEZE IN EFFECT**
> 
> Last verified green state: `590966c` (2026-05-14)
> Production smoke tests: **26/26 passing**
> Runtime 500s: **0**
> Deprecated sources: **0**
> Canonical source: `vehicle_fitments` table ONLY

## Purpose

This document establishes change control for all fitment-related code, data, and scripts. The fitment system is business-critical and requires explicit approval before any changes.

## Scope - Files Requiring Approval

### Core Fitment Logic
- `src/lib/fitment/**` - Resolver, aliases, staggered logic, trim explosion
- `src/lib/fitment-db/**` - DB access, normalization, overrides, schema
- `src/app/api/vehicles/**` - Years, makes, models, trims, tire-sizes APIs
- `src/app/api/wheels/fitment-search/**` - Wheel fitment endpoint
- `src/app/api/tires/search/**` - Tire search (uses fitment)

### Data & Schema
- `src/db/schema*` - Any schema touching fitment tables
- `drizzle/**` - Migration files affecting `vehicle_fitments`
- `prisma/schema.prisma` - If fitment tables are defined here

### Scripts
- `scripts/*fitment*` - Any fitment-related scripts
- `scripts/*usaf*` - US AutoForce enrichment
- `scripts/*wheelpros*` - WheelPros validation
- `scripts/*staggered*` - Staggered inference/merge
- `scripts/*audit*` - Fitment audits
- `scripts/*merge*` - Data merge scripts
- `scripts/*import*` - Data import scripts

### Configuration
- `src/lib/fitment-db/normalization.ts` - Make/model/trim aliases
- `src/lib/fitment/makeAliases.ts` - Make normalization
- `src/lib/fitment-db/modelAliases.ts` - Model variants
- `src/lib/fitment/trimExplosion.ts` - Trim parsing

## Approval Process

### For Code Changes

1. **Create PR** with clear description of what's changing and why
2. **Add approval marker** to commit message or PR body:
   ```
   APPROVED_FITMENT_CHANGE=true
   Approved by: [name]
   Reason: [brief explanation]
   ```
3. **Run local validation**:
   ```bash
   npm run fitment:check
   ```
4. **CI will verify**:
   - Canonical source check passes
   - No deprecated config/static usage
   - Production smoke tests pass (staging equivalent)
   - Fitment health check passes

### For Bulk Data Scripts

**NO bulk data scripts may run without ALL of the following:**

| Requirement | Description |
|-------------|-------------|
| **Dry-run report** | Must show exact changes before applying |
| **Snapshot path** | Pre-change backup location |
| **Exact record count** | How many records affected |
| **Rollback command** | Exact command to revert changes |
| **Approval** | Explicit approval from Scott |

Example dry-run output required:
```
DRY RUN COMPLETE
Records to modify: 326
Records to create: 0
Records to deprecate: 652
Snapshot: scripts/snapshots/snapshot-2026-05-14.json
Rollback: node scripts/rollback.mjs --snapshot=scripts/snapshots/snapshot-2026-05-14.json
```

### For Schema Changes

1. **Never modify `vehicle_fitments` schema** without migration plan
2. **Additive changes only** - no column drops without data migration
3. **Test on staging first** with full smoke test suite
4. **Document rollback procedure** before applying

## CI/CD Guards

### Pre-Deploy Checks (Automated)

The following checks run automatically on any PR touching fitment files:

1. **Canonical Source Check** - Ensures only `vehicle_fitments` is used at runtime
2. **Fitment Health Check** - Validates resolver logic, no 500s on sample vehicles
3. **Deprecated Usage Check** - Fails if config table or static JSON is referenced
4. **Smoke Test** - 26 core vehicle tests must pass

### Build Failure Conditions

Build will **FAIL** if:
- Fitment files changed without `APPROVED_FITMENT_CHANGE=true` marker
- Canonical source check fails
- Smoke tests fail
- Deprecated source usage detected

## Current Green State

| Metric | Value |
|--------|-------|
| Commit | `590966c` |
| Date | 2026-05-14 |
| Smoke Tests | 26/26 passing |
| Runtime 500s | 0 |
| Deprecated Sources | 0 |
| Canonical Source | `vehicle_fitments` ONLY |

### Verified Working

- ✅ Staggered vehicles (Camaro, Corvette, Mustang, BMW M3/M4)
- ✅ HD trucks with LT sizes
- ✅ Mercedes-Benz make alias resolution
- ✅ Sedan resolver (Toyota, Honda)
- ✅ Wheel fitment search
- ✅ Tire search API

## Emergency Rollback

If a fitment regression is detected in production:

1. **Identify last known good commit** (currently `590966c`)
2. **Revert to that commit**:
   ```bash
   git revert HEAD --no-commit
   git checkout 590966c -- src/lib/fitment src/lib/fitment-db src/app/api/vehicles src/app/api/wheels/fitment-search
   git commit -m "Emergency rollback: fitment regression"
   git push
   ```
3. **Notify team** of rollback and investigate root cause
4. **Run full smoke test** to verify recovery

## Contact

For fitment change approvals, contact: **Scott**

---

*Last updated: 2026-05-14*
*This document is enforced by CI checks and CODEOWNERS.*
