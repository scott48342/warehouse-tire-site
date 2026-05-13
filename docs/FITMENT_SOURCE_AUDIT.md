# Fitment Source Audit

**Generated:** 2026-05-13  
**Audited By:** Claude (Subagent)  
**Codebase:** Warehouse Tire Direct (`warehouse-tire-site`)

---

## Executive Summary

All fitment resolution now flows through the **Canonical Resolver** (`canonicalResolver.ts`) as the single source of truth. External APIs are **disabled** for runtime fitment lookups - all data must be pre-imported via admin tools.

### Key Data Sources (Priority Order)

| Source | Table | Description |
|--------|-------|-------------|
| **1. vehicleFitmentConfigurations** | `vehicle_fitment_configurations` | Trim-specific OEM wheel+tire configs (highest confidence) |
| **2. vehicleFitments** | `vehicle_fitments` | Imported fitment records (certified status required) |
| **3. wheelSizeTrimMapping** | `wheel_size_trim_mappings` | Manual trim → fitment mappings from Wheel-Size API |
| **4. Static JSON** | `oem-tire-sizes.json` | Hardcoded fallback data (legacy) |
| **5. Classic Fitment** | `classic_fitments` | Pre-1985 and 1990-1999 platform-based fitment |

### ⚠️ CRITICAL: External APIs REMOVED

| API | Status | Notes |
|-----|--------|-------|
| Wheel-Size.com API | ❌ REMOVED | Only used for admin imports, never runtime |
| WheelPros Fitment API | ❌ REMOVED | Only for PRODUCT data (inventory), not fitment |
| Any other fitment API | ❌ BLOCKED | DB-first architecture enforced |

---

## API Audit Table

| Route | Data Sources | Uses canonicalResolver? | Fallback Behavior | Notes |
|-------|--------------|------------------------|-------------------|-------|
| `/api/vehicles/tire-sizes` | 1. Config table → 2. vehicleFitments (via canonicalResolver) → 3. Cache → 4. Static JSON | ✅ YES | Logs to unresolved_fitments if no data | Primary tire size lookup |
| `/api/vehicles/years` | vehicleFitments via `coverage.ts` | ❌ No (direct DB) | Static year range | Returns years with coverage |
| `/api/vehicles/makes` | vehicleFitments (direct query) | ❌ No (direct DB) | Static makes list | Returns makes in DB |
| `/api/vehicles/models` | vehicleFitments via `coverage.ts` | ❌ No (direct DB) | Static models | Returns models with coverage |
| `/api/vehicles/trims` | canonicalResolver → vehicleFitments | ✅ YES | Empty array | Explodes grouped trims |
| `/api/vehicles/configurations` | vehicleFitmentConfigurations → vehicleFitments (legacy) | ❌ No (getFitmentConfigurations) | Legacy oemWheelSizes fallback | Wheel diameter configs |
| `/api/wheels/fitment-search` | canonicalResolver → vehicleFitments → classicFitment | ✅ YES | BLOCKED if trim mismatch | Returns wheels + validation |
| `/api/tires/search` | Internal `/api/vehicles/tire-sizes` call | ✅ YES (indirect) | Empty results | Searches TireWeb/WheelPros |
| `/api/public/fitment/years` | vehicleFitments (direct query) | ❌ No | Empty array | Public API |
| `/api/public/fitment/makes` | vehicleFitments (direct query) | ❌ No | Empty array | Public API |
| `/api/public/fitment/models` | vehicleFitments (direct query) | ❌ No | Empty array | Public API |
| `/api/public/fitment/trims` | vehicleFitments (direct query) | ❌ No | Empty array | Public API |
| `/api/public/fitment/specs` | profileService → vehicleFitments | ❌ No (uses profileService) | null | Public API |
| `/api/packages/recommended` | listLocalFitments → vehicleFitments | ❌ No (direct DB) | Empty packages | Package builder |
| `/api/pos/quotes` | N/A (storage only) | N/A | N/A | Stores quotes to pos_quotes |
| `/api/fitment/profile` | buildFitmentProfile (legacy) | ❌ No (legacy path) | 404 error | Legacy profile endpoint |
| `/api/classic/fitment` | classicFitment lookup | ❌ No | "not_found" response | Classic vehicles only |
| `/api/classic/tires` | classicFitment + tire search | ❌ No | Modern fallback | Classic tire search |

---

## Detailed API Analysis

### 1. `/api/vehicles/tire-sizes` ⭐ CRITICAL PATH

**File:** `src/app/api/vehicles/tire-sizes/route.ts`

**Resolution Flow:**
```
1. vehicleFitmentConfigurations (config table)
   ↓ if not found
2. vehicleFitments via resolveVehicleFitment() (canonicalResolver)
   ↓ if blocked
   → Return "trimResolutionRequired" response
   ↓ if not found
3. In-memory cache
   ↓ if not found
4. Static JSON (oem-tire-sizes.json)
   ↓ if not found
5. Log to unresolved_fitments, return empty
```

**Key Fields Returned:**
- `tireSizes[]` - OEM tire sizes
- `wheelDiameters.needsSelection` - Whether size gate needed
- `staggered` - Staggered fitment info
- `debug.matchedBy` - How resolution occurred

**Blocking Behavior:**
- If `canonicalResolver` returns `matchedBy: "blocked"`, returns `trimResolutionRequired: true`
- Provides `availableTrims[]` for user selection

---

### 2. `/api/vehicles/trims`

**File:** `src/app/api/vehicles/trims/route.ts`

**Resolution Flow:**
```
1. Redis cache (getCachedTrims)
   ↓ if not found
2. getAtomicTrimOptions() from canonicalResolver
   → Explodes grouped trims ("LX, Sport, EX" → 3 options)
   ↓ if empty
3. Legacy getTrimsWithCoverage() from coverage.ts
   → Direct DB query, processes grouped trims
```

**Key Behavior:**
- **Explodes grouped trims** - "LX, Sport, EX" becomes 3 separate options
- Each atomic trim gets a `canonicalFitmentId`
- Filters base trims when `isPremiumTrimUxEnabled()`

---

### 3. `/api/wheels/fitment-search` ⭐ CRITICAL PATH

**File:** `src/app/api/wheels/fitment-search/route.ts`

**Resolution Flow:**
```
1. CANONICAL IDENTITY CHECK (2026-05-04)
   → resolveVehicleFitment() from canonicalResolver
   → If "blocked" → Return error with availableTrims
   
2. getFitmentProfileWithHdSupport() from profileService
   → Handles SRW/DRW for HD trucks
   → If "needs_manual_verification" → Return blocked response
   
3. Direct DB fallback (listLocalFitments)
   → If profileService fails, try raw DB query
   
4. Classic Fitment fallback
   → For pre-1985 / 1990-1999 vehicles
   
5. Legacy fallback (handleLegacyPath)
   → Last resort, logs as legacy usage
```

**Key Behavior:**
- Uses **same canonicalResolver** as tire-sizes (2026-05-04 fix)
- Blocks when trims have different wheel specs
- Supports HD trucks with SRW/DRW selection
- Calculates fitment confidence and can block low-confidence results

---

### 4. `/api/tires/search`

**File:** `src/app/api/tires/search/route.ts`

**Resolution Flow (for vehicle-based search):**
```
1. If wheelDiameter provided:
   → Use wheel diameter to filter tire sizes
   
2. If vehicle params (year/make/model):
   → Internal call to /api/vehicles/tire-sizes
   → Uses tire sizes from that response
   
3. If size param directly:
   → Direct size search (bypasses fitment)
```

**Data Sources for Tires:**
- WheelPros local DB (`wp_tires`)
- TireWeb SOAP API (ATD, NTW, K&M, US AutoForce)
- US AutoForce direct API

**Fitment Source:** Relies on `/api/vehicles/tire-sizes` for vehicle-based searches.

---

### 5. `/api/vehicles/configurations`

**File:** `src/app/api/vehicles/configurations/route.ts`

**Resolution Flow:**
```
1. getFitmentConfigurations() from getFitmentConfigurations.ts
   ↓
   a. vehicleFitmentConfigurations table (new structured data)
   ↓ if empty
   b. vehicleFitments.oemWheelSizes/oemTireSizes (legacy fallback)
```

**Key Behavior:**
- Returns wheel diameter options with `isDefault` flag
- Determines whether to show blocking gate vs inline switcher
- Uses **trim normalization** for cosmetic packages (e.g., "SE Nightshade" → "SE")

---

### 6. `/api/public/fitment/*` (Public API Suite)

**Files:** `src/app/api/public/fitment/{years,makes,models,trims,specs}/route.ts`

**Service Layer:** `src/lib/api/public-fitment-service.ts`

**All routes use DIRECT DB queries** (no canonicalResolver):
- `getPublicYears()` - DISTINCT years from vehicleFitments
- `getPublicMakes(year?)` - DISTINCT makes, optional year filter
- `getPublicModels(make, year?)` - DISTINCT models for make
- `getPublicTrims(year, make, model)` - All trims (not exploded)
- `getPublicSpecs(year, make, model, trimId)` - Full specs via profileService

**⚠️ Note:** `/api/public/fitment/trims` returns raw `displayTrim` values (may include grouped), unlike `/api/vehicles/trims` which explodes them.

---

### 7. `/api/packages/recommended`

**File:** `src/app/api/packages/recommended/route.ts`

**Engine:** `src/lib/packages/engine.ts`

**Resolution Flow:**
```
1. getVehicleFitment() internal function
   → listLocalFitments() from getFitment.ts
   → Direct DB query to vehicleFitments (certified only)
   
2. Match trim by:
   a. displayTrim contains trim param
   b. modificationId contains trim param
   c. First record with bolt pattern + tire sizes
```

**Key Behavior:**
- Does NOT use canonicalResolver (direct DB)
- Generates packages based on fitment envelope
- Uses techfeed for wheel candidates

---

### 8. Classic Fitment APIs

**Files:** 
- `src/app/api/classic/fitment/route.ts`
- `src/lib/classic-fitment/classicLookup.ts`

**Resolution Flow:**
```
1. isClassicVehicle(year, make) check
   → Pre-1985 OR 1990-1999
   
2. getClassicFitment(year, make, model)
   → Looks up classic_fitments table
   → Returns platform-based fitment (e.g., "GM_G_BODY")
   
3. If not found → Return "not_found" for modern fallback
```

**Classic Platform Examples:**
- Ford Fox Body (1979-1993)
- GM G-Body (1978-1988)
- Mopar A-Body (1967-1976)

---

## Canonical Resolver Deep Dive

**File:** `src/lib/fitment/canonicalResolver.ts`

### Resolution Methods (Priority Order)

| Method | When Used | Confidence |
|--------|-----------|------------|
| `exact_modification_id` | modificationId matches DB record | HIGH |
| `wheel_size_trim_mapping` | APPROVED Wheel-Size mapping exists | HIGH/MEDIUM |
| `exact_canonical_trim` | Exact atomic displayTrim match | HIGH |
| `normalized_trim` | Normalized/slugified match | MEDIUM |
| `generation_submodel` | Same generation + submodel | MEDIUM |
| `identical_fallback` | All trims have same fitment | LOW |
| `blocked` | Trims differ, cannot resolve | N/A |
| `not_found` | No match at all | N/A |

### Grouped Trim Handling

The resolver **explodes grouped trims** (e.g., "LX, Sport, EX"):
- Only splits on `,` or ` / ` (spaced slash)
- Does NOT split "R/T", "GT/CS" (compact slash = single trim)
- Each atomic trim gets unique `canonicalFitmentId`

### Blocking Logic

Returns `matchedBy: "blocked"` when:
1. Requested trim not found in candidates
2. Multiple candidates have **different tire sizes**
3. Cannot safely fall back to model-level data

---

## Data Source Hierarchy

```
┌─────────────────────────────────────────────────┐
│  vehicleFitmentConfigurations                   │  ← HIGHEST PRIORITY
│  (OEM wheel+tire configs, trim-specific)        │
└─────────────────────────────────────────────────┘
              ↓ fallback
┌─────────────────────────────────────────────────┐
│  wheelSizeTrimMappings                          │
│  (Manual Wheel-Size API mappings, APPROVED)     │
└─────────────────────────────────────────────────┘
              ↓ fallback
┌─────────────────────────────────────────────────┐
│  vehicleFitments                                │
│  (Imported fitment records, certified only)     │
│  ⚠️ May have grouped displayTrim values         │
└─────────────────────────────────────────────────┘
              ↓ fallback
┌─────────────────────────────────────────────────┐
│  classicFitments                                │
│  (Platform-based, pre-1985 / 1990-1999)         │
└─────────────────────────────────────────────────┘
              ↓ fallback
┌─────────────────────────────────────────────────┐
│  Static JSON (oem-tire-sizes.json)              │  ← LOWEST PRIORITY
│  (Hardcoded, legacy fallback)                   │
└─────────────────────────────────────────────────┘
```

---

## Database Tables Used

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `vehicle_fitments` | Main fitment records | modificationId, displayTrim, boltPattern, oemTireSizes, oemWheelSizes, certificationStatus |
| `vehicle_fitment_configurations` | Structured OEM configs | wheelDiameter, tireSize, isDefault, axlePosition |
| `wheel_size_trim_mappings` | Wheel-Size API mappings | wsDisplayTrim, ourModificationId, status, matchConfidence |
| `classic_fitments` | Pre-1985 / 1990-1999 vehicles | platformCode, boltPattern, centerBore |
| `modification_aliases` | Trim ID aliasing | requestedId, canonicalId |
| `unresolved_fitments` | Gap tracking | year, make, model, trim, searchType |

---

## Key Code Paths

### For Tire Pages (SRP)
```
VehicleTirePage
  ↓
/api/vehicles/tire-sizes
  ↓
canonicalResolver.resolveVehicleFitment()
  ↓
getFitmentConfigurations() || vehicleFitments query
```

### For Wheel Pages (SRP)
```
WheelSearchResults
  ↓
/api/wheels/fitment-search
  ↓
canonicalResolver.resolveVehicleFitment() [BLOCKING CHECK]
  ↓
getFitmentProfileWithHdSupport()
  ↓
buildFitmentEnvelope() → filter wheels
```

### For Package Builder
```
PackageRecommendations
  ↓
/api/packages/recommended
  ↓
listLocalFitments() [DIRECT DB]
  ↓
techfeed wheel candidates
```

### For POS
```
POSQuoteBuilder (React component)
  ↓
Uses same APIs as retail:
  - /api/vehicles/* for YMM
  - /api/wheels/fitment-search for wheels
  - /api/tires/search for tires
```

---

## Recommendations

### ✅ Consistent Resolution
All critical paths (`tire-sizes`, `wheels/fitment-search`) now use `canonicalResolver` as of 2026-05-04.

### ⚠️ Inconsistencies Found

1. **Public API doesn't explode grouped trims**
   - `/api/public/fitment/trims` returns raw `displayTrim`
   - Internal `/api/vehicles/trims` explodes them
   - Consider aligning behavior

2. **Package builder uses direct DB**
   - `/api/packages/recommended` bypasses canonicalResolver
   - May show packages for wrong trim if grouped

3. **Profile endpoint is legacy**
   - `/api/fitment/profile` uses old `buildFitmentProfile`
   - Should migrate to canonicalResolver

### 📊 Monitoring

- **Gap tracking:** `unresolved_fitments` table
- **Resolution method logging:** Check `debug.matchedBy` in API responses
- **Admin endpoint:** `/api/admin/fitment-gaps` for analysis

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-13 | Initial audit created |
| 2026-05-04 | canonicalResolver unified across tire-sizes and wheels/fitment-search |
| 2026-04-26 | certificationStatus required for all runtime queries |
| 2026-04-02 | External API fallback removed (DB-first architecture) |
