/**
 * Pricing Service
 * 
 * Centralized pricing calculation for all products.
 * 
 * WHEELS (30% markup model):
 * - If cost exists: price = cost × 1.30
 * - Fallback #1: map × 1.30
 * - Fallback #2: msrp × 0.85
 * 
 * TIRES: Unchanged (uses existing MAP/MSRP logic)
 * 
 * @created 2026-04-03
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
  pricingMethod: "cost_markup" | "map_markup" | "msrp_discount" | "passthrough" | "no_price";
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

/** MSRP discount multiplier for wheels when no cost/MAP available */
const WHEEL_MSRP_DISCOUNT = 0.85;

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
  // WHEEL PRICING (30% markup model)
  // ═══════════════════════════════════════════════════════════════════════════
  if (productType === "wheel") {
    // Priority 1: Cost-based pricing (30% markup)
    if (costValue !== null) {
      const sellPrice = Math.round(costValue * WHEEL_MARKUP * 100) / 100;
      return {
        sellPrice,
        pricingMethod: "cost_markup",
        originalInput,
        margin: ((sellPrice - costValue) / sellPrice) * 100,
      };
    }
    
    // Priority 2: MAP-based pricing (30% markup)
    if (mapValue !== null) {
      const sellPrice = Math.round(mapValue * WHEEL_MARKUP * 100) / 100;
      
      // Log missing cost for monitoring
      if (sku) {
        console.log(`[pricing] MISSING_COST wheel ${sku}: using MAP fallback (${mapValue} → ${sellPrice})`);
      }
      
      return {
        sellPrice,
        pricingMethod: "map_markup",
        originalInput,
      };
    }
    
    // Priority 3: MSRP discount (15% off)
    if (msrpValue !== null) {
      const sellPrice = Math.round(msrpValue * WHEEL_MSRP_DISCOUNT * 100) / 100;
      
      // Log missing cost and MAP for monitoring
      if (sku) {
        console.log(`[pricing] MISSING_COST_MAP wheel ${sku}: using MSRP fallback (${msrpValue} → ${sellPrice})`);
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
