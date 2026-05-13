# Fitment Data Architecture

> **Last Updated:** 2026-05-13  
> **Status:** Canonical documentation

## Canonical Data Source

**`vehicle_fitments` is the single source of truth for all fitment data.**

All runtime APIs read from this table. There is no fallback chain.

### Table: `vehicle_fitments`

| Column | Purpose |
|--------|---------|
| `id` | UUID primary key |
| `year` | Model year |
| `make` | Make (lowercase or mixed case) |
| `model` | Model (format varies: spaces or hyphens) |
| `display_trim` | Trim name for display |
| `raw_trim` | Original source trim name |
| `modification_id` | Canonical ID for this YMM+Trim combo |
| `bolt_pattern` | Bolt pattern (e.g., "5x114.3") |
| `center_bore_mm` | Hub bore in mm |
| `thread_size` | Lug nut thread size |
| `seat_type` | Lug nut seat type |
| `offset_min_mm` / `offset_max_mm` | Safe offset range |
| `oem_wheel_sizes` | Array of OEM wheel specs |
| `oem_tire_sizes` | Array of OEM tire sizes (enriched by USAF) |
| `certification_status` | "certified" or "needs_review" |
| `quality_tier` | Data quality indicator |

### Query Pattern

All fitment lookups use this pattern:

```sql
SELECT * FROM vehicle_fitments
WHERE year = $1
  AND make ILIKE $2
  AND model ILIKE $3
  AND certification_status = 'certified'
```

**Important:** Model names vary in format (spaces vs hyphens). Use `getModelVariants()` from `modelAliases.ts` to generate variants for matching.

---

## Consolidation Guard (2026-05-13)

A multi-layer protection ensures `vehicle_fitments` remains the single runtime source:

### 1. Pre-Deploy Static Analysis

**Script:** `scripts/test-fitment-consolidation.mjs`

Scans customer-facing code paths and **fails build** if any import `vehicleFitmentConfigurations`:

```bash
node scripts/test-fitment-consolidation.mjs
```

**Checked paths:**
- `src/app/api/vehicles/*`
- `src/app/api/wheels/*`
- `src/app/api/tires/*`
- `src/lib/fitment/*`
- `src/lib/fitment-db/canonicalResolver.ts`
- `src/lib/fitment-db/coverage.ts`

**Admin exceptions** (allowed to use deprecated table):
- `src/app/api/admin/*`
- `scripts/*`

### 2. Runtime Health Check

**Endpoint:** `GET /api/admin/fitment/health`

Verifies sentinel vehicles resolve correctly through all customer-facing paths:
- Trims API
- Tire Sizes API
- Wheel fitment resolution

**Returns:**
- `200` with `"status": "healthy"` — all vehicles pass
- `500` with `"status": "unhealthy"` — failures detected

**Use for:** Post-deploy verification, monitoring dashboards, CI smoke tests.

### 3. Schema Documentation

`src/lib/fitment-db/schema.ts` includes:
- Prominent deprecation notice on `vehicleFitmentConfigurations`
- Architecture comments explaining the consolidation
- Guidance on correct table usage

---

## Data Sources

### Runtime (Customer-Facing)

| Source | Table | Used For |
|--------|-------|----------|
| **CANONICAL** | `vehicle_fitments` | All YMM/fitment resolution |

### Audit/Enrichment Only

| Source | Purpose |
|--------|---------|
| US AutoForce API | Tire size enrichment (write to `oem_tire_sizes`) |
| WheelPros Techfeed | Product data (wheels, tires) — NOT fitment |
| Wheel-Size.com API | Historical trim mapping data (no new queries) |

---

## Deprecated Tables

### ~~`vehicle_fitment_configurations`~~

**Status:** DEPRECATED (2026-05-13) — **DO NOT USE IN RUNTIME**

This table stores wheel/tire configurations separately. It was an architectural experiment that created data duplication and source-of-truth confusion.

**Current usage:**
- ✅ Admin data review (`/api/admin/fitment/config-enrichment`)
- ✅ Historical reference
- ❌ Customer-facing APIs
- ❌ Runtime fitment resolution

**Future:** Will be dropped after all useful data migrated to `vehicle_fitments`.

---

## USAF Enrichment Pipeline

Tire size enrichments from US AutoForce are written directly to `vehicle_fitments.oem_tire_sizes`:

```
USAF API → Audit Script → Approved Enrichments → vehicle_fitments.oem_tire_sizes
```

See `/scripts/usaf-import-enrichments.mjs` for the enrichment process.

---

## Deprecated Fallbacks

### ~~Static JSON fitment files~~

**Status:** DEPRECATED (2026-05-13)

Historical fallback for when DB was unavailable. No longer used.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-13 | Added consolidation guard (pre-deploy test + health check endpoint) |
| 2026-05-13 | `vehicle_fitments` declared canonical. Config table deprecated. |
| 2026-05-04 | Canonical resolver introduced for trim handling. |
| 2026-04-02 | External wheel-size.com references removed. |
