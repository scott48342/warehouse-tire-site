# Wheel-Size Assisted Canonical Submodel Resolution

## Problem Statement

Users selecting a specific trim (e.g., "2024 Ford F-150 XLT") are sometimes shown 2-3 tire/wheel size options when their exact trim only has ONE factory package. This happens because:

1. Our trim labels don't perfectly map to Wheel-Size's modification/submodel identifiers
2. We aggregate multiple configurations into arrays instead of resolving to exact pairings
3. The UI shows all possible sizes even when only one applies to the selected trim

## Goal

When a user selects a specific trim that maps to exactly ONE OEM factory configuration, **auto-select it** and skip the size chooser. Only show the wheel/tire size chooser when the trim genuinely has multiple factory packages.

## Key Constraints

1. **NO REGRESSION** - Existing functionality must continue to work
2. **DB-first runtime** - No live Wheel-Size API calls in customer-facing flows
3. **Use cached data** - Wheel-Size data is already in `fitment_source_records`
4. **Store resolved mappings** - Save canonical mappings in DB for fast lookup
5. **Admin review** - Flag mismatches and ambiguous cases for human review

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     IMPORT/SYNC TIME (Background)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  fitment_source_records ──► Parse WS modifications ──► Match trims  │
│  (cached Wheel-Size)         Extract configs           to our DB    │
│                                                                      │
│                              ▼                                       │
│                                                                      │
│              wheel_size_trim_mappings (NEW TABLE)                    │
│              - Maps our trim → WS modification                       │
│              - Stores match confidence                               │
│              - Links to resolved configs                             │
│                                                                      │
│                              ▼                                       │
│                                                                      │
│              vehicle_fitment_configurations                          │
│              - Exact OEM wheel+tire pairings                         │
│              - isDefault flag for single-config trims                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     RUNTIME (Customer-facing)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User selects: 2024 Ford F-150 XLT                                  │
│                                                                      │
│                              ▼                                       │
│                                                                      │
│  canonicalResolver.ts:                                               │
│  1. Look up trim in wheel_size_trim_mappings                        │
│  2. Get linked configurations from vehicle_fitment_configurations   │
│  3. If exactly 1 config → return it (auto-select)                   │
│  4. If multiple configs → return list for UI chooser                │
│  5. If no mapping → fall back to current behavior                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### New Database Table

```sql
CREATE TABLE wheel_size_trim_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Our vehicle identity
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  our_trim VARCHAR(255) NOT NULL,
  our_modification_id VARCHAR(255),
  
  -- Wheel-Size identity
  ws_generation VARCHAR(100),
  ws_modification VARCHAR(255) NOT NULL,
  ws_submodel VARCHAR(255),
  ws_trim VARCHAR(255),
  
  -- Match metadata
  match_method VARCHAR(50) NOT NULL, -- exact, normalized, fuzzy, manual
  match_confidence VARCHAR(20) NOT NULL, -- high, medium, low
  
  -- Configuration count (for quick single-config detection)
  config_count INTEGER NOT NULL DEFAULT 1,
  has_single_config BOOLEAN NOT NULL DEFAULT false,
  default_config_id UUID REFERENCES vehicle_fitment_configurations(id),
  
  -- Admin review
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_reason VARCHAR(255),
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(year, make, model, our_trim)
);
```

### Resolution Logic Updates

```typescript
// In canonicalResolver.ts

export interface EnhancedFitmentResult extends CanonicalFitmentResult {
  // New fields
  wsMapping: WheelSizeTrimMapping | null;
  configurations: VehicleFitmentConfiguration[];
  autoSelectedConfig: VehicleFitmentConfiguration | null;
  showSizeChooser: boolean;
  chooserReason: 'multiple_configs' | 'no_mapping' | 'low_confidence' | null;
}

async function resolveWithWheelSizeMapping(input: ResolverInput): Promise<EnhancedFitmentResult> {
  // 1. Try to find WS trim mapping
  const wsMapping = await getWheelSizeTrimMapping(input);
  
  if (wsMapping && wsMapping.match_confidence === 'high') {
    // 2. Get configurations for this mapping
    const configs = await getConfigurationsForMapping(wsMapping);
    
    if (configs.length === 1) {
      // Single config - auto-select!
      return {
        ...baseResult,
        wsMapping,
        configurations: configs,
        autoSelectedConfig: configs[0],
        showSizeChooser: false,
        chooserReason: null,
      };
    }
    
    if (configs.length > 1) {
      // Multiple configs - show chooser with specific options
      return {
        ...baseResult,
        wsMapping,
        configurations: configs,
        autoSelectedConfig: configs.find(c => c.isDefault) || null,
        showSizeChooser: true,
        chooserReason: 'multiple_configs',
      };
    }
  }
  
  // 3. Fall back to current behavior
  return legacyResolve(input);
}
```

### UI Changes

```tsx
// In FitmentSelector or VehicleSelector

// Before: Always show size chooser if multiple sizes in array
// After: Check showSizeChooser flag from resolver

const { showSizeChooser, configurations, autoSelectedConfig } = fitmentResult;

if (!showSizeChooser && autoSelectedConfig) {
  // Single config - skip chooser, proceed with auto-selected
  proceedWithConfiguration(autoSelectedConfig);
  return;
}

if (showSizeChooser && configurations.length > 1) {
  // Multiple configs - show explicit chooser with labels
  return (
    <ConfigurationChooser
      configurations={configurations}
      defaultSelected={autoSelectedConfig}
      onSelect={proceedWithConfiguration}
    />
  );
}
```

## Implementation Phases

### Phase 1: Schema & Import (Background Job)
- [ ] Create `wheel_size_trim_mappings` table
- [ ] Build import script to parse cached WS data and create mappings
- [ ] Populate `vehicle_fitment_configurations` with explicit configs
- [ ] Add admin API to review/approve mappings

### Phase 2: Resolver Enhancement
- [ ] Update `canonicalResolver.ts` with WS mapping lookup
- [ ] Add configuration resolution logic
- [ ] Return `showSizeChooser` flag and config data
- [ ] Maintain backward compatibility

### Phase 3: UI Updates
- [ ] Update fitment selector to use new resolver output
- [ ] Only show size chooser when `showSizeChooser: true`
- [ ] Add configuration labels (e.g., "20\" Standard" vs "22\" Sport Package")
- [ ] Show confidence indicator if low confidence mapping

### Phase 4: Admin Tools
- [ ] Admin page to review unmatched/low-confidence trims
- [ ] Manual mapping interface
- [ ] Bulk approve/reject tools
- [ ] Mismatch alerts

## Success Criteria

1. **Reduction in size chooser displays**: Track % of vehicle selections that skip the size chooser
2. **Accuracy**: Manual audit of auto-selected configs vs customer complaints
3. **No regressions**: Existing fitment flows continue to work
4. **Admin efficiency**: Time to review/approve new mappings

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wrong auto-selection | Confidence threshold + admin review |
| Missing WS data | Fall back to current behavior |
| Performance impact | Pre-computed mappings, indexed lookups |
| Stale mappings | Regular re-sync from WS cache |
