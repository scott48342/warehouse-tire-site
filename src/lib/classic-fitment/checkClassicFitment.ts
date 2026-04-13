/**
 * Server-side classic fitment check
 * 
 * Used by page components to determine if a vehicle should use
 * the classic fitment flow vs modern trim-based flow.
 * 
 * RULE: Only activates when classic data EXISTS for the vehicle.
 * Falls back to modern flow otherwise (no dead ends).
 */

import { getClassicFitment } from "./classicLookup";
import type { ClassicFitmentResponse } from "./types";

export interface ClassicFitmentCheck {
  isClassic: boolean;
  data: ClassicFitmentResponse | null;
}

/**
 * Check if a vehicle should use classic fitment flow
 * 
 * @returns { isClassic: true, data: ClassicFitmentResponse } if classic data exists
 * @returns { isClassic: false, data: null } if should use modern flow
 */
export async function checkClassicFitment(
  year: number | string,
  make: string,
  model: string
): Promise<ClassicFitmentCheck> {
  const yearNum = typeof year === "string" ? parseInt(year, 10) : year;
  
  if (isNaN(yearNum) || !make || !model) {
    return { isClassic: false, data: null };
  }

  try {
    const result = await getClassicFitment(yearNum, make, model);
    
    if (result.fitmentMode === "classic" && result.isClassicVehicle) {
      return {
        isClassic: true,
        data: result as ClassicFitmentResponse,
      };
    }
    
    // Not found or fallback - use modern flow
    return { isClassic: false, data: null };
  } catch (err) {
    console.error("[checkClassicFitment] Error:", err);
    // On error, fall back to modern flow (no dead ends)
    return { isClassic: false, data: null };
  }
}

/**
 * Transform classic fitment response to card data format
 */
export function toClassicCardData(response: ClassicFitmentResponse) {
  return {
    platform: response.platform,
    vehicle: response.vehicle,
    specs: response.specs,
    stockReference: response.stockReference,
    recommendedRange: response.recommendedRange,
    confidence: response.confidence,
    fitmentStyle: response.fitmentStyle,
    verificationRequired: response.verificationRequired,
    verificationNote: response.verificationNote,
    notes: null, // Notes are internal, not shown on card by default
  };
}
