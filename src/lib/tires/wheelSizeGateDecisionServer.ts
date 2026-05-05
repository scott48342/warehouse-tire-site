/**
 * Wheel Size Gate Decision - Server-Side Version
 * 
 * This file contains the async version that can access the database.
 * Use this in server components and API routes.
 * 
 * For client components, use wheelSizeGateDecision.ts instead.
 * 
 * PHASE 3: Integrates with canonicalResolver's trimMapping to respect
 * approved Wheel-Size trim mappings. When showSizeChooser=false and
 * autoSelectedConfig exists, skip the gate entirely.
 */

import { getFitmentConfigurations } from "@/lib/fitment-db/getFitmentConfigurations";
import { 
  getWheelSizeGateDecision, 
  type WheelSizeGateDecision,
  type WheelSizeGateReason,
} from "./wheelSizeGateDecision";
import type { CanonicalFitmentResult } from "@/lib/fitment/canonicalResolver";

// ============================================================================
// Types for trim mapping integration
// ============================================================================

export type TrimMappingGateReason = WheelSizeGateReason | 'trim_mapping_auto_select' | 'trim_mapping_multi_config';

export interface TrimMappingGateDecision extends Omit<WheelSizeGateDecision, 'reason'> {
  reason: TrimMappingGateReason;
  /** When true, an approved trim mapping determined this decision */
  trimMappingApplied: boolean;
  /** Auto-selected config from trim mapping (if showSizeChooser=false) */
  autoSelectedConfig: {
    configId: string;
    wheelDiameter: number;
    tireSize: string;
    isDefault: boolean;
  } | null;
  /** Mapped configurations (if showSizeChooser=true) */
  mappedConfigurations: Array<{
    configId: string;
    wheelDiameter: number;
    tireSize: string;
    isDefault: boolean;
  }>;
  /** Debug info for troubleshooting */
  debug: {
    chooserReason: string | null;
    mappingId: string | null;
    mappingStatus: string | null;
    matchConfidence: string | null;
  };
}

// ============================================================================
// Trim Mapping Integration (Phase 3)
// ============================================================================

/**
 * PHASE 3: Get wheel size gate decision with trim mapping integration.
 * 
 * This is the PRIMARY function for determining wheel size gate behavior.
 * It respects approved trim mappings from canonicalResolver to skip
 * unnecessary chooser screens.
 * 
 * Priority order:
 * 1. Approved trim mapping (HIGHEST) - if found and approved with high/medium confidence
 *    - showSizeChooser=false → skip gate, auto-select
 *    - showSizeChooser=true → show only mapped configurations
 * 2. Configuration table - if rows exist with high confidence
 * 3. Verified patterns (platform knowledge)
 * 4. API data with heuristics (lowest confidence)
 * 
 * NO REGRESSION RULES:
 * - Customer-facing trim labels remain unchanged
 * - Wheel-Size engine labels are NOT exposed as trims
 * - Existing exact modificationId behavior unchanged
 * - Existing grouped fallback behavior unchanged when no approved mapping
 */
export async function getWheelSizeGateDecisionWithTrimMapping(params: {
  year: number;
  make: string;
  model: string;
  trim?: string;
  modificationId?: string;
  apiDiameters: number[];
  apiNeedsSelection: boolean;
  /** Trim mapping result from canonicalResolver (Phase 2) */
  trimMapping?: CanonicalFitmentResult['trimMapping'];
}): Promise<TrimMappingGateDecision> {
  const { trimMapping, ...baseParams } = params;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Check approved trim mapping (Phase 3)
  // ═══════════════════════════════════════════════════════════════════════════
  if (trimMapping?.found && trimMapping.mappingId) {
    // Mapping exists - check if it should skip the chooser
    if (!trimMapping.showSizeChooser && trimMapping.autoSelectedConfig) {
      // AUTO-SELECT: Skip the gate entirely
      return {
        show: false,
        reason: 'trim_mapping_auto_select',
        options: [trimMapping.autoSelectedConfig.wheelDiameter],
        confidence: 'high',
        trimMappingApplied: true,
        autoSelectedConfig: trimMapping.autoSelectedConfig,
        mappedConfigurations: trimMapping.configurations,
        debug: {
          chooserReason: trimMapping.chooserReason,
          mappingId: trimMapping.mappingId,
          mappingStatus: 'approved', // Only approved mappings reach here
          matchConfidence: 'high', // Only high/medium confidence reach here
        },
      };
    }
    
    // showSizeChooser=true: Show chooser with ONLY mapped configurations
    if (trimMapping.showSizeChooser && trimMapping.configurations.length > 0) {
      const mappedDiameters = [...new Set(
        trimMapping.configurations.map(c => c.wheelDiameter)
      )].sort((a, b) => a - b);
      
      return {
        show: true,
        reason: 'trim_mapping_multi_config',
        options: mappedDiameters,
        confidence: 'high',
        trimMappingApplied: true,
        autoSelectedConfig: trimMapping.autoSelectedConfig,
        mappedConfigurations: trimMapping.configurations,
        debug: {
          chooserReason: trimMapping.chooserReason,
          mappingId: trimMapping.mappingId,
          mappingStatus: 'approved',
          matchConfidence: 'high',
        },
      };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: Use existing async decision logic (config table + patterns)
  // ═══════════════════════════════════════════════════════════════════════════
  const baseDecision = await getWheelSizeGateDecisionAsync(baseParams);
  
  return {
    ...baseDecision,
    trimMappingApplied: false,
    autoSelectedConfig: null,
    mappedConfigurations: [],
    debug: {
      chooserReason: trimMapping?.chooserReason ?? null,
      mappingId: trimMapping?.mappingId ?? null,
      mappingStatus: null,
      matchConfidence: null,
    },
  };
}

/**
 * Enhanced decision function that checks configuration table first.
 * 
 * Priority order:
 * 1. Configuration table (highest confidence) - if rows exist with high confidence
 * 2. Verified patterns (platform knowledge)
 * 3. API data with heuristics (lowest confidence)
 * 
 * This is the preferred function for server-side use where async is available.
 * 
 * NOTE: For Phase 3+ integration, use getWheelSizeGateDecisionWithTrimMapping instead.
 */
export async function getWheelSizeGateDecisionAsync(params: {
  year: number;
  make: string;
  model: string;
  trim?: string;
  modificationId?: string;
  apiDiameters: number[];
  apiNeedsSelection: boolean;
}): Promise<WheelSizeGateDecision> {
  const { year, make, model, modificationId, apiDiameters } = params;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Check configuration table for high-confidence data
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const configResult = await getFitmentConfigurations(
      year, make, model, modificationId
    );
    
    // Only use config data if it's high confidence
    if (configResult.usedConfigTable && configResult.confidence === 'high') {
      if (configResult.uniqueDiameters.length === 1) {
        return {
          show: false,
          reason: 'single_size',
          options: configResult.uniqueDiameters,
          confidence: 'high',
        };
      }
      
      if (configResult.hasMultipleDiameters) {
        return {
          show: true,
          reason: 'config_exact',
          options: configResult.uniqueDiameters,
          confidence: 'high',
        };
      }
    }
  } catch (err) {
    // Config table lookup failed - continue to fallbacks
    console.warn('[WheelSizeGate] Config table lookup failed, using fallbacks:', err);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: Use synchronous decision logic (verified patterns + heuristics)
  // ═══════════════════════════════════════════════════════════════════════════
  return getWheelSizeGateDecision(params);
}

/**
 * Get wheel diameters from configuration table with fallback
 * Utility function for APIs that need diameter info with source tracking
 */
export async function getConfiguredDiametersForVehicle(
  year: number,
  make: string,
  model: string,
  modificationId?: string
): Promise<{
  diameters: number[];
  source: 'config' | 'legacy' | 'none';
  confidence: 'high' | 'medium' | 'low';
}> {
  try {
    const configResult = await getFitmentConfigurations(year, make, model, modificationId);
    return {
      diameters: configResult.uniqueDiameters,
      source: configResult.source,
      confidence: configResult.confidence,
    };
  } catch {
    return {
      diameters: [],
      source: 'none',
      confidence: 'low',
    };
  }
}
