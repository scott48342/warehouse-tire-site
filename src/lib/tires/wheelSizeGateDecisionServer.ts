/**
 * Wheel Size Gate Decision - Server-Side Version
 * 
 * This file contains the async version that can access the database.
 * Use this in server components and API routes.
 * 
 * For client components, use wheelSizeGateDecision.ts instead.
 */

import { getFitmentConfigurations } from "@/lib/fitment-db/getFitmentConfigurations";
import { 
  getWheelSizeGateDecision, 
  type WheelSizeGateDecision 
} from "./wheelSizeGateDecision";

/**
 * Enhanced decision function that checks configuration table first.
 * 
 * Priority order:
 * 1. Configuration table (highest confidence) - if rows exist with high confidence
 * 2. Verified patterns (platform knowledge)
 * 3. API data with heuristics (lowest confidence)
 * 
 * This is the preferred function for server-side use where async is available.
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
