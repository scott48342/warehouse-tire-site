# Build Error Audit - 2026-05-13

## Current Build Status
**1 TypeScript error** after clean build

## Current Error
```
./src/lib/catalog-store.ts:74:7
Type error: Type '{ slug: string | null; name: string | null; years: number[]; }[]' is not assignable to type 'CatalogModel[]'.
```

---

## DB vs Drizzle Schema Mismatch Report

### 🔴 CRITICAL MISMATCHES

#### catalog_makes
**DB has 5 columns:**
- id, slug, name, created_at, updated_at

**Drizzle schema has extra fields I added that DON'T exist in DB:**
- ❌ make (doesn't exist)
- ❌ displayName (doesn't exist)
- ❌ supplier (doesn't exist)
- ❌ isActive (doesn't exist)
- ❌ sortOrder (doesn't exist)

#### catalog_models  
**DB has 7 columns:**
- id, make_slug, slug, name, years (ARRAY), created_at, updated_at

**Drizzle schema has extra fields that DON'T exist in DB:**
- ❌ makeId (doesn't exist)
- ❌ make (doesn't exist)
- ❌ model (doesn't exist)
- ❌ displayName (doesn't exist)
- ❌ yearStart (doesn't exist)
- ❌ yearEnd (doesn't exist)
- ❌ supplier (doesn't exist)
- ❌ isActive (doesn't exist)
- ❌ sortOrder (doesn't exist)

#### km_image_mappings
**DB has 5 columns:**
- part_number, prodline, folder_id, image_url, fetched_at

**Drizzle schema has extra fields that DON'T exist in DB:**
- ❌ id (doesn't exist - part_number is the key)
- ❌ brand (doesn't exist)
- ❌ model (doesn't exist)
- ❌ thumbnailUrl (doesn't exist)
- ❌ supplier (doesn't exist)
- ❌ createdAt (doesn't exist)
- ❌ updatedAt (doesn't exist)

### ⚠️ TYPE MISMATCHES

#### vehicle_year fields
**DB type:** `character varying` (string)
**Drizzle schema:** `integer`

Affected tables:
- email_subscribers.vehicle_year
- abandoned_carts.vehicle_year
- cart_add_events.vehicle_year

### ✅ TABLES THAT MATCH (verified)

#### email_campaigns (39 columns) ✅
All fields exist in DB:
- send_mode, campaign_type, from_name, reply_to, content_json
- monthly_rule_json, include_free_shipping_banner, include_price_match
- utm_campaign, notes, discount_*, etc.

#### email_subscribers (24 columns) ✅
All fields exist (but vehicle_year is varchar, not int)

#### email_campaign_recipients (15 columns) ✅
All fields exist including message_id

#### email_campaign_events (11 columns) ✅
All fields exist including provider_event_id

#### abandoned_carts (39 columns) ✅
All fields exist including source, user_agent, ip_address, subtotal
(but vehicle_year is varchar)

#### cart_add_events (26 columns) ✅
All fields exist including sku, rear_sku, brand, product_name, price_at_time
NOTE: sku is NOT NULL in DB, but schema has it nullable

#### wheel_size_trim_mappings (33 columns) ✅
All fields exist

---

## Error Categories

| Category | Count | Description |
|----------|-------|-------------|
| Missing DB column | ~15 | Fields in Drizzle that don't exist in real DB |
| Type mismatch | 3 | vehicle_year should be varchar, not integer |
| Nullable mismatch | 1 | sku is NOT NULL in DB but nullable in schema |
| Dead admin code | ? | Need to audit |

---

## Recommended Fix Batches

### Batch 1: Revert Bad Schema Additions
**DO IMMEDIATELY**
1. Fix `catalog_makes` schema to match DB (5 cols only)
2. Fix `catalog_models` schema to match DB (7 cols only)
3. Fix `km_image_mappings` schema to match DB (5 cols only)

### Batch 2: Fix Type Mismatches
1. Change `vehicleYear` from `integer` to `varchar` in:
   - emailSubscribers
   - abandonedCarts
   - cartAddEvents
2. Make `sku` NOT NULL in cartAddEvents

### Batch 3: Fix Code Using Wrong Field Names
1. `catalog-store.ts` uses `catalogMakes.name` - OK, exists
2. `catalog-store.ts` uses `catalogModels.makeSlug` - OK, exists
3. `catalog-store.ts` uses `catalogModels.name` - OK, exists
4. `catalog-store.ts` uses `catalogModels.years` - OK, exists

### Batch 4: Dead Code Audit
- Audit admin features that reference non-existent columns
- Consider disabling rather than inventing columns

---

## Fields I Added That Are NOT Backed by Real DB

### schema-catalog.ts - MUST REVERT
- catalogMakes: make, displayName, supplier, isActive, sortOrder
- catalogModels: makeId, make, model, displayName, yearStart, yearEnd, supplier, isActive, sortOrder

### schema-images.ts - MUST REVERT
- kmImageMappings: id, brand, model, thumbnailUrl, supplier, createdAt, updatedAt

### schema-email.ts - VERIFIED OK
- Most fields exist in DB ✅
- But vehicleYear type is wrong (should be varchar)

---

## Action Items

1. ⚠️ **DO NOT** invent more schema fields
2. ✅ Revert catalog_makes schema to DB reality
3. ✅ Revert catalog_models schema to DB reality  
4. ✅ Revert km_image_mappings schema to DB reality
5. ✅ Fix vehicleYear type (integer → varchar)
6. ✅ Fix sku nullability
7. 🔍 Audit code using wrong fields
