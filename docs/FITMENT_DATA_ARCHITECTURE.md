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

## Deprecated Tables

### ~~`vehicle_fitment_configurations`~~

**Status:** DEPRECATED (2026-05-13)

This table was an attempt to store wheel/tire configurations separately but created data duplication and source-of-truth confusion.

**DO NOT:**
- Write new data to this table
- Use this table in runtime queries
- Reference this table in new code

**Migration path:** Data can remain for historical reference. Will be dropped in a future cleanup.

## Deprecated Fallbacks

### ~~Static JSON fitment files~~

**Status:** DEPRECATED (2026-05-13)

Historical fallback for when DB was unavailable. No longer used.

**Files affected:**
- Any `fitment-*.json` files in `src/data/`
- Static fallback code in `getFallbackFitment()` functions

## USAF Enrichment Pipeline

Tire size enrichments from US AutoForce are written directly to `vehicle_fitments.oem_tire_sizes`:

```
USAF API → Audit Script → Approved Enrichments → vehicle_fitments.oem_tire_sizes
```

See `/scripts/usaf-import-enrichments.mjs` for the enrichment process.

## Pre-Deploy Audit

The CI/CD pipeline includes a fitment source audit that fails if:

1. Any runtime code reads from `vehicle_fitment_configurations`
2. Any runtime code uses static JSON fitment fallback
3. Any write operation targets the deprecated config table

See `/scripts/audit-fitment-sources.mjs` for the audit script.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-13 | `vehicle_fitments` declared canonical. Config table deprecated. |
| 2026-05-04 | Canonical resolver introduced for trim handling. |
| 2026-04-02 | External wheel-size.com references removed. |
