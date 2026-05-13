# Fitment Source Consolidation Plan
**Status**: DRAFT - Architecture Review Required
**Created**: 2026-05-13
**Last Updated**: 2026-05-13

---

## 1. Problem Statement

We have multiple fitment data sources causing inconsistent behavior:
- Fixes applied to one source don't propagate to other runtime paths
- Different APIs read from different sources with different fallback logic
- No single source of truth for canonical vehicle identity

### Current Sources (Preliminary)

| Source | Purpose | Used By |
|--------|---------|---------|
| `vehicle_fitments` | Primary fitment data | Most APIs via canonicalResolver |
| `vehicle_fitment_configurations` | Trim-specific configs | config-enrichment, wheelSizeTrimMapping |
| `fitment_overrides` | Manual fixes | applyOverrides |
| `oem-tire-sizes.json` | Static fallback | tire-sizes API (legacy) |
| Classic fitment system | Pre-1980 vehicles | classic-fitment routes |
| `wheel_size_trim_mappings` | Trim → config mapping | canonicalResolver Phase 2 |

---

## 2. Current Architecture (To Be Audited)

### 2.1 Runtime API Paths

```
┌─────────────────────────────────────────────────────────────────┐
│                     Customer-Facing APIs                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/vehicles/tire-sizes ──┐                                   │
│  /api/vehicles/trims ───────┼──► canonicalResolver ──► vehicleFitments
│  /api/wheels/fitment-search─┤         │                         │
│                             │         └──► applyOverrides       │
│                             │         └──► wheelSizeTrimMapping │
│                             │                                   │
│  /api/vehicles/years ───────┼──► Direct DB query                │
│  /api/vehicles/makes ───────┤                                   │
│  /api/vehicles/models ──────┘                                   │
│                                                                 │
│  /api/tires/search ─────────┬──► classicLookup (pre-1980)       │
│  /api/classic/fitment ──────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Known Issues

1. **Static JSON fallback** (`oem-tire-sizes.json`) in tire-sizes API can serve stale data
2. **vehicleFitmentConfigurations** table is underutilized - config-enrichment writes to it but canonicalResolver doesn't read from it directly
3. **Classic fitment** is a separate system for pre-1980 vehicles
4. **Overrides** are applied post-resolution, not integrated into source

---

## 3. Proposed Architecture

### 3.1 Option A: Promote `vehicle_fitment_configurations` as Canonical Source

**Concept**: Make `vehicle_fitment_configurations` the source of truth for all trim-specific data.

**Pros**:
- Already structured for multi-config vehicles
- Has tire size + wheel spec per configuration
- Clean schema

**Cons**:
- Requires major migration from `vehicle_fitments`
- Need to handle 1:many relationship (one vehicle, many configs)

### 3.2 Option B: Create New Canonical Layer (RECOMMENDED)

**Concept**: Create a new unified service/table that owns canonical identity.

```typescript
// NEW: Canonical Fitment Service
interface CanonicalFitmentProfile {
  // Identity
  canonicalId: string;           // Unique identifier
  year: number;
  make: string;
  model: string;
  trim: string;                  // Atomic trim (not grouped)
  
  // Core fitment
  boltPattern: string;
  centerBoreMm: number;
  offsetMinMm: number;
  offsetMaxMm: number;
  
  // Tire configurations
  configurations: FitmentConfiguration[];
  
  // Staggered support
  isStaggered: boolean;
  frontSpec?: WheelSpec;
  rearSpec?: WheelSpec;
  
  // HD/Commercial
  isDRW?: boolean;
  isSRW?: boolean;
  
  // Metadata
  sourceConfidence: 'high' | 'medium' | 'low';
  primarySource: string;
  lastVerified: Date;
  
  // Aliases
  aliases: string[];             // Other trim names that map here
}

interface FitmentConfiguration {
  configId: string;
  wheelDiameter: number;
  wheelWidth: number;
  tireSize: string;
  isOEM: boolean;
  isDefault: boolean;
}
```

**Implementation**:

1. **New table**: `canonical_fitments`
   - Migrated from `vehicle_fitments` with deduplication
   - Grouped trims exploded into atomic entries
   - Configurations merged from `vehicle_fitment_configurations`

2. **New service**: `getCanonicalFitmentProfile()`
   - Single entry point for ALL runtime APIs
   - Reads from `canonical_fitments` only
   - No fallback chains

3. **Migration layers** (temporary):
   - `vehicle_fitments` → read-only, import staging
   - `vehicle_fitment_configurations` → merged into canonical
   - `oem-tire-sizes.json` → removed from runtime
   - `fitment_overrides` → applied during migration, then deprecated

---

## 4. Migration Strategy

### Phase 1: Audit (THIS DOCUMENT)
- [ ] Document all runtime read paths
- [ ] Document all source priorities
- [ ] Identify vehicles with conflicts
- [ ] Create blocking tests

### Phase 2: Build Canonical Layer
- [ ] Create `canonical_fitments` table schema
- [ ] Build migration script from vehicle_fitments
- [ ] Build merge logic for configurations
- [ ] Create `getCanonicalFitmentProfile()` service

### Phase 3: Migrate APIs One-by-One
- [ ] `/api/vehicles/tire-sizes` → canonical
- [ ] `/api/vehicles/trims` → canonical
- [ ] `/api/wheels/fitment-search` → canonical
- [ ] YMM selectors → canonical
- [ ] Package builder → canonical
- [ ] POS flows → canonical

### Phase 4: Deprecate Legacy Sources
- [ ] Remove static JSON fallback
- [ ] Make vehicle_fitments write-only (import staging)
- [ ] Merge overrides into canonical records
- [ ] Archive old tables

---

## 5. Test Vehicles (Blocking Tests)

Every API change must pass these tests:

| Vehicle | Test Case |
|---------|-----------|
| 2022-2023 F-150 Lightning | EV, new vehicle |
| 2022-2024 Silverado 2500 HD | HD truck, SRW/DRW |
| 2024 Toyota Tacoma | Popular truck, many trims |
| 2024 Ford Bronco | Many wheel options |
| 2024 Chevrolet Corvette | Staggered, performance |
| 2024 BMW M3 | Staggered, luxury |
| 2024 Ram 3500 | HD truck, DRW |

### Test Suite Requirements

For each vehicle, verify:
1. ✅ Appears in YMM selector (years/makes/models/trims)
2. ✅ `/api/vehicles/tire-sizes` returns correct OEM sizes
3. ✅ `/api/wheels/fitment-search` returns compatible wheels
4. ✅ Package builder can create valid packages
5. ✅ POS flow can complete
6. ✅ Works on both local and national sites

---

## 6. Migration Report Structure

For every 2000-current vehicle, classify:

| Status | Description |
|--------|-------------|
| `legacy_only` | Only in vehicle_fitments, not in configs |
| `config_only` | Only in vehicle_fitment_configurations |
| `both_match` | In both tables, data matches |
| `both_conflict` | In both tables, data conflicts |
| `static_only` | Only in static JSON |
| `missing_canonical` | No canonical identity established |
| `duplicate_identity` | Multiple records for same trim |

---

## 7. Open Questions

1. Should classic fitment (pre-1980) be merged into canonical or kept separate?
2. How to handle grouped trims during migration (explode vs. keep)?
3. Should overrides be permanent records or applied at read time?
4. What's the rollback strategy if migration fails?

---

## 8. Next Steps

1. **Immediate**: Complete runtime API audit (subagent running)
2. **Immediate**: Test vehicle migration status report (subagent running)
3. **Review**: Architecture decision (Option A vs B)
4. **Plan**: Detailed migration timeline
5. **Build**: Canonical service prototype

---

## Appendix A: Files to Audit

### Critical Runtime Paths
- `src/app/api/vehicles/tire-sizes/route.ts`
- `src/app/api/vehicles/trims/route.ts`
- `src/app/api/wheels/fitment-search/route.ts`
- `src/app/api/tires/search/route.ts`
- `src/lib/fitment/canonicalResolver.ts`
- `src/lib/fitment-db/profileService.ts`

### Data Sources
- `src/lib/fitment-db/schema.ts` (table definitions)
- `src/data/oem-tire-sizes.json` (static fallback)
- `src/lib/classic-fitment/` (classic system)

### Import/Enrichment
- `src/lib/fitment-db/importFitment.ts`
- `src/app/api/admin/fitment/config-enrichment/route.ts`
- `src/lib/usaf-fitment/` (USAF enrichment)
