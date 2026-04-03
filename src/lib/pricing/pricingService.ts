/**
 * Pricing Service
 * 
 * Centralized pricing calculation for all products.
 * 
 * WHEELS:
 * - If cost exists: price = cost × 1.30 (30% margin), **capped at MSRP**
 * - Fallback #1: MAP (Minimum Advertised Price), capped at MSRP
 * - Fallback #2: MSRP passthrough
 * - MSRP is always the price ceiling — never sell above it
 * 
 * TIRES: Passthrough (uses MAP or MSRP directly)
 * 
 * @created 2026-04-03
 * @updated 2026-07-15 - Added MSRP ceiling to all pricing paths
 */

// ============================================================================
// Types
// ============================================================================

export type ProductType = "wheel" | "tire" | "accessory";

export interface PricingInput {
  productType: ProductType;
  cost?: number | null;
  map?: number | null;  // MAP = Minimum Advertised Price
  msrp?: number | null; // MSRP = Manufacturer's Suggested Retail Price
  sku?: string;         // For logging
}

export interface PricingResult {
  sellPrice: number;
  pricingMethod: "cost_markup" | "map_passthrough" | "msrp_discount" | "passthrough" | "no_price";
  originalInput: {
    cost: number | null;
    map: number | null;
    msrp: number | null;
  };
  margin?: number; // Percentage margin if calculable
}

// ============================================================================
// Configuration
// ============================================================================

/** Markup multiplier for wheels (30% markup) */
const WHEEL_MARKUP = 1.30;

/** @deprecated MSRP is now used as-is (no discount) — kept for backwards compat */
const WHEEL_MSRP_DISCOUNT = 1.0;

/** Minimum valid price threshold */
const MIN_VALID_PRICE = 1;

// ============================================================================
// Pricing Calculation
// ============================================================================

/**
 * Calculate sell price for a product
 * 
 * @param input - Pricing input with product type and cost/map/msrp values
 * @returns PricingResult with calculated sell price and method used
 */
export function calculateSellPrice(input: PricingInput): PricingResult {
  const { productType, cost, map, msrp, sku } = input;
  
  // Normalize inputs
  const costValue = typeof cost === "number" && cost > MIN_VALID_PRICE ? cost : null;
  const mapValue = typeof map === "number" && map > MIN_VALID_PRICE ? map : null;
  const msrpValue = typeof msrp === "number" && msrp > MIN_VALID_PRICE ? msrp : null;
  
  const originalInput = {
    cost: costValue,
    map: mapValue,
    msrp: msrpValue,
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WHEEL PRICING (30% markup model with MSRP ceiling)
  // ═══════════════════════════════════════════════════════════════════════════
  if (productType === "wheel") {
    // Priority 1: Cost-based pricing (30% markup, capped at MSRP)
    if (costValue !== null) {
      let sellPrice = Math.round(costValue * WHEEL_MARKUP * 100) / 100;
      let pricingMethod: PricingResult["pricingMethod"] = "cost_markup";
      
      // Cap at MSRP if markup exceeds it
      if (msrpValue !== null && sellPrice > msrpValue) {
        if (sku) {
          console.log(`[pricing] MSRP_CAP wheel ${sku}: cost markup (${sellPrice}) > MSRP (${msrpValue}), using MSRP`);
        }
        sellPrice = Math.round(msrpValue * 100) / 100;
        pricingMethod = "msrp_discount"; // Treated as MSRP-based pricing
      }
      
      return {
        sellPrice,
        pricingMethod,
        originalInput,
        margin: ((sellPrice - costValue) / sellPrice) * 100,
      };
    }
    
    // Priority 2: MAP (Minimum Advertised Price) — use as-is, capped at MSRP
    if (mapValue !== null) {
      let sellPrice = Math.round(mapValue * 100) / 100;
      let pricingMethod: PricingResult["pricingMethod"] = "map_passthrough";
      
      // Cap at MSRP if MAP exceeds it (shouldn't happen but defensive)
      if (msrpValue !== null && sellPrice > msrpValue) {
        if (sku) {
          console.log(`[pricing] MSRP_CAP wheel ${sku}: MAP (${sellPrice}) > MSRP (${msrpValue}), using MSRP`);
        }
        sellPrice = Math.round(msrpValue * 100) / 100;
        pricingMethod = "msrp_discount";
      } else if (sku) {
        console.log(`[pricing] MISSING_COST wheel ${sku}: using MAP (${mapValue})`);
      }
      
      return {
        sellPrice,
        pricingMethod,
        originalInput,
      };
    }
    
    // Priority 3: MSRP passthrough (was 15% off, now just use MSRP)
    if (msrpValue !== null) {
      const sellPrice = Math.round(msrpValue * 100) / 100;
      
      // Log missing cost and MAP for monitoring
      if (sku) {
        console.log(`[pricing] MISSING_COST_MAP wheel ${sku}: using MSRP (${msrpValue})`);
      }
      
      return {
        sellPrice,
        pricingMethod: "msrp_discount",
        originalInput,
      };
    }
    
    // No valid pricing data
    if (sku) {
      console.warn(`[pricing] NO_PRICE wheel ${sku}: no cost, MAP, or MSRP available`);
    }
    
    return {
      sellPrice: 0,
      pricingMethod: "no_price",
      originalInput,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIRE PRICING (unchanged - passthrough MAP/MSRP)
  // ═══════════════════════════════════════════════════════════════════════════
  if (productType === "tire") {
    // Use MAP first, then MSRP
    const price = mapValue ?? msrpValue ?? 0;
    
    return {
      sellPrice: price,
      pricingMethod: price > 0 ? "passthrough" : "no_price",
      originalInput,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORY PRICING (passthrough for now)
  // ═══════════════════════════════════════════════════════════════════════════
  const price = mapValue ?? msrpValue ?? 0;
  
  return {
    sellPrice: price,
    pricingMethod: price > 0 ? "passthrough" : "no_price",
    originalInput,
  };
}

/**
 * Calculate sell price for a wheel (convenience function)
 */
export function calculateWheelSellPrice(opts: {
  cost?: number | null;
  map?: number | null;
  msrp?: number | null;
  sku?: string;
}): number {
  const result = calculateSellPrice({
    productType: "wheel",
    ...opts,
  });
  return result.sellPrice;
}

/**
 * Calculate sell price for a tire (convenience function)
 */
export function calculateTireSellPrice(opts: {
  map?: number | null;
  msrp?: number | null;
  sku?: string;
}): number {
  const result = calculateSellPrice({
    productType: "tire",
    ...opts,
  });
  return result.sellPrice;
}

// ============================================================================
// Exports
// ============================================================================

export const pricingService = {
  calculateSellPrice,
  calculateWheelSellPrice,
  calculateTireSellPrice,
  WHEEL_MARKUP,
  WHEEL_MSRP_DISCOUNT,
};

export default pricingService;
