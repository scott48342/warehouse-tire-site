/**
 * Saved Quote Resume/Revalidation Service
 * 
 * Revalidates a saved quote snapshot against current commerce state.
 * Does NOT mutate the saved quote - returns comparison results only.
 * 
 * Reuses existing commerce systems:
 * - Wheel lookup via /api/wheels/sku/[sku]
 * - Tire search via search functions
 * - Inventory via /api/cart/validate-availability
 * - Fitment via universalFitmentResolver
 * - Pricing via existing price calculation functions
 * 
 * @created 2026-08-24
 */

import type { SavedQuoteSnapshot, SavedQuoteItem, SavedQuoteVehicle } from "./types";
import type { 
  ResumeValidationResult, 
  ValidatedItem, 
  VehicleValidationResult,
  CurrentPricingSummary,
  ValidationWarning,
  ItemValidationStatus,
} from "./resumeTypes";
import { resolveUniversalFitment } from "@/lib/fitment/universalFitmentResolver";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { calculateWheelSellPrice, resolveWheelMsrp } from "@/lib/pricing";
import { getInventoryForSku } from "@/lib/inventoryCache";
import { getPool } from "@/lib/vehicleFitment";
import pg from "pg";

const { Pool } = pg;

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// ============================================================================
// Main Revalidation Function
// ============================================================================

export async function revalidateSavedQuote(
  quoteId: string,
  snapshot: SavedQuoteSnapshot
): Promise<ResumeValidationResult> {
  const validatedAt = new Date().toISOString();
  const warnings: ValidationWarning[] = [];
  
  // 1. Validate vehicle
  const vehicleResult = await validateVehicle(snapshot.vehicle);
  
  if (!vehicleResult.valid) {
    warnings.push({
      code: "vehicle_invalid",
      severity: "error",
      message: vehicleResult.reason || "Vehicle configuration is no longer valid",
    });
  }
  
  // 2. Validate each item
  const validatedItems = await Promise.all(
    snapshot.items.map(item => validateItem(item, snapshot.vehicle, vehicleResult))
  );
  
  // 3. Check for unavailable items
  const unavailableItems = validatedItems.filter(vi => vi.status === "unavailable");
  const fitmentFailures = validatedItems.filter(vi => vi.status === "fitment_failed");
  const priceChanges = validatedItems.filter(vi => vi.status === "price_changed");
  const partialQty = validatedItems.filter(vi => vi.status === "quantity_partial");
  
  // 4. Calculate current pricing
  const pricing = calculateCurrentPricing(snapshot.pricing, validatedItems);
  
  // 5. Add warnings for changes
  if (priceChanges.length > 0) {
    const totalPriceDiff = priceChanges.reduce((sum, vi) => 
      sum + ((vi.priceDifference || 0) * vi.savedQty), 0);
    
    if (totalPriceDiff > 0) {
      warnings.push({
        code: "prices_increased",
        severity: "warning",
        message: `Prices have increased by $${totalPriceDiff.toFixed(2)} since you saved this quote`,
      });
    } else if (totalPriceDiff < 0) {
      warnings.push({
        code: "prices_decreased",
        severity: "info",
        message: `Good news! Prices have decreased by $${Math.abs(totalPriceDiff).toFixed(2)}`,
      });
    }
  }
  
  if (partialQty.length > 0) {
    for (const item of partialQty) {
      warnings.push({
        code: "partial_quantity",
        severity: "warning",
        message: `Only ${item.currentAvailableQty} of ${item.savedQty} available for ${item.savedItem.brand} ${item.savedItem.model}`,
        itemSku: item.savedItem.sku,
      });
    }
  }
  
  // Check for expired promotions
  if (snapshot.pricing.discount && !pricing.currentDiscount) {
    warnings.push({
      code: "discount_expired",
      severity: "warning",
      message: `Your saved discount (${snapshot.pricing.discount.code}) has expired`,
    });
  }
  
  // 6. Determine if user can continue
  const canContinue = unavailableItems.length === 0 && 
                      fitmentFailures.length === 0 &&
                      vehicleResult.valid;
  
  let continueBlockedReason: string | undefined;
  if (!canContinue) {
    if (!vehicleResult.valid) {
      continueBlockedReason = "Vehicle configuration is no longer valid";
    } else if (unavailableItems.length > 0) {
      continueBlockedReason = `${unavailableItems.length} item(s) are no longer available`;
    } else if (fitmentFailures.length > 0) {
      continueBlockedReason = `${fitmentFailures.length} item(s) no longer fit your vehicle`;
    }
  }
  
  // 7. Build cart preview (only if can continue)
  let cartPreview: ResumeValidationResult["cartPreview"];
  if (canContinue) {
    const cartItems = validatedItems
      .filter(vi => vi.currentItem && vi.status !== "unavailable" && vi.status !== "fitment_failed")
      .map(vi => ({
        type: vi.savedItem.type,
        sku: vi.currentItem!.sku,
        quantity: vi.savedQty,
        unitPrice: vi.currentItem!.unitPrice,
        brand: vi.currentItem!.brand,
        model: vi.currentItem!.model,
      }));
    
    const subtotal = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    
    cartPreview = {
      items: cartItems,
      subtotal,
      estimatedTax: pricing.currentTaxEstimate ?? null,
      estimatedShipping: pricing.currentShippingEstimate ?? null,
      total: pricing.currentTotal ?? null,
    };
  }
  
  return {
    quoteId,
    validatedAt,
    vehicle: vehicleResult,
    savedVehicle: snapshot.vehicle,
    items: validatedItems,
    pricing,
    canContinue,
    continueBlockedReason,
    warnings,
    cartPreview,
  };
}

// ============================================================================
// Vehicle Validation
// ============================================================================

async function validateVehicle(vehicle: SavedQuoteVehicle): Promise<VehicleValidationResult> {
  try {
    const year = parseInt(vehicle.year, 10);
    if (isNaN(year)) {
      return { valid: false, reason: "Invalid vehicle year" };
    }
    
    // Use Universal Fitment Resolver
    const fitment = await resolveUniversalFitment({
      year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim || null,
    });
    
    if (!fitment.found) {
      return { 
        valid: false, 
        reason: `Vehicle not found: ${vehicle.year} ${vehicle.make} ${vehicle.model}` 
      };
    }
    
    // Check if we have enough data for fitment validation
    if (!fitment.boltPattern) {
      return {
        valid: true, // Still valid, just incomplete data
        reason: "Limited fitment data available - fitment verification may be incomplete",
        fitmentData: {
          boltPattern: fitment.boltPattern,
          centerBore: fitment.centerBore,
          threadSize: fitment.threadSize,
          lugSeatType: fitment.lugSeatType,
          oemTireSizes: fitment.oemTireSizes,
          wheelDiameterRange: fitment.wheelDiameterRange,
        },
      };
    }
    
    return {
      valid: true,
      fitmentData: {
        boltPattern: fitment.boltPattern,
        centerBore: fitment.centerBore,
        threadSize: fitment.threadSize,
        lugSeatType: fitment.lugSeatType,
        oemTireSizes: fitment.oemTireSizes,
        wheelDiameterRange: fitment.wheelDiameterRange,
      },
    };
  } catch (err) {
    console.error("[resumeService] Vehicle validation error:", err);
    return { valid: false, reason: "Failed to validate vehicle configuration" };
  }
}

// ============================================================================
// Item Validation
// ============================================================================

async function validateItem(
  item: SavedQuoteItem,
  _vehicle: SavedQuoteVehicle,
  vehicleResult: VehicleValidationResult
): Promise<ValidatedItem> {
  const baseResult: ValidatedItem = {
    savedItem: item,
    status: "needs_review",
    savedUnitPrice: item.unitPrice,
    savedQty: item.quantity,
  };
  
  try {
    if (item.type === "wheel") {
      return await validateWheel(item, vehicleResult);
    } else if (item.type === "tire") {
      return await validateTire(item, vehicleResult);
    } else if (item.type === "accessory") {
      return await validateAccessory(item);
    }
    
    return baseResult;
  } catch (err) {
    console.error(`[resumeService] Item validation error for ${item.sku}:`, err);
    return {
      ...baseResult,
      status: "unavailable",
      message: "Failed to validate item",
      unavailableReason: "supplier_error",
    };
  }
}

// ============================================================================
// Wheel Validation
// ============================================================================

async function validateWheel(
  item: SavedQuoteItem,
  vehicleResult: VehicleValidationResult
): Promise<ValidatedItem> {
  const baseResult: ValidatedItem = {
    savedItem: item,
    status: "needs_review",
    savedUnitPrice: item.unitPrice,
    savedQty: item.quantity,
  };
  
  // Try WheelPros/techfeed first
  const wheel = await getTechfeedWheelBySku(item.sku);
  
  if (wheel) {
    // Get current inventory and pricing
    const inventory = await getInventoryForSku(item.sku);
    const mapValue = inventory?.mapPrice ?? (wheel.map_price ? Number(wheel.map_price) : null);
    const rawMsrp = inventory?.msrp ?? (wheel.msrp ? Number(wheel.msrp) : null);
    const correctedMsrp = !mapValue
      ? resolveWheelMsrp({ sku: wheel.sku, brandCd: wheel.brand_cd ?? wheel.brand_desc, diameter: wheel.diameter, msrp: rawMsrp })
      : rawMsrp;
    const currentPrice = calculateWheelSellPrice({ sku: wheel.sku, map: mapValue, msrp: correctedMsrp });
    
    const totalQty = (inventory?.totalQty ?? 0);
    
    // Check availability
    if (totalQty < item.quantity) {
      if (totalQty === 0) {
        return {
          ...baseResult,
          status: "unavailable",
          currentItem: {
            sku: wheel.sku,
            brand: wheel.brand_desc || "Unknown",
            model: wheel.product_desc || wheel.sku,
            unitPrice: currentPrice,
            availableQty: 0,
            supplier: "wheelpros",
            imageUrl: wheel.images?.[0],
          },
          currentUnitPrice: currentPrice,
          currentAvailableQty: 0,
          message: "This wheel is currently out of stock",
          unavailableReason: "out_of_stock",
        };
      } else {
        return {
          ...baseResult,
          status: "quantity_partial",
          currentItem: {
            sku: wheel.sku,
            brand: wheel.brand_desc || "Unknown",
            model: wheel.product_desc || wheel.sku,
            unitPrice: currentPrice,
            availableQty: totalQty,
            supplier: "wheelpros",
            imageUrl: wheel.images?.[0],
          },
          currentUnitPrice: currentPrice,
          currentAvailableQty: totalQty,
          priceDifference: currentPrice - item.unitPrice,
          priceChangePercent: item.unitPrice > 0 ? ((currentPrice - item.unitPrice) / item.unitPrice) * 100 : 0,
          message: `Only ${totalQty} available (you saved ${item.quantity})`,
        };
      }
    }
    
    // Check fitment if we have vehicle data
    if (vehicleResult.fitmentData?.boltPattern && wheel.bolt_pattern_metric) {
      const wheelBoltPattern = wheel.bolt_pattern_metric;
      const vehicleBoltPattern = vehicleResult.fitmentData.boltPattern;
      
      // Simple bolt pattern check (could be more sophisticated)
      if (!boltPatternsMatch(wheelBoltPattern, vehicleBoltPattern)) {
        return {
          ...baseResult,
          status: "fitment_failed",
          currentItem: {
            sku: wheel.sku,
            brand: wheel.brand_desc || "Unknown",
            model: wheel.product_desc || wheel.sku,
            unitPrice: currentPrice,
            availableQty: totalQty,
            supplier: "wheelpros",
          },
          currentUnitPrice: currentPrice,
          currentAvailableQty: totalQty,
          message: `Wheel bolt pattern (${wheelBoltPattern}) doesn't match vehicle (${vehicleBoltPattern})`,
        };
      }
    }
    
    // Price comparison
    const priceDiff = currentPrice - item.unitPrice;
    const status: ItemValidationStatus = Math.abs(priceDiff) < 0.01 ? "unchanged" : "price_changed";
    
    return {
      ...baseResult,
      status,
      currentItem: {
        sku: wheel.sku,
        brand: wheel.brand_desc || "Unknown",
        model: wheel.product_desc || wheel.sku,
        unitPrice: currentPrice,
        availableQty: totalQty,
        supplier: "wheelpros",
        imageUrl: wheel.images?.[0],
      },
      currentUnitPrice: currentPrice,
      currentAvailableQty: totalQty,
      priceDifference: priceDiff,
      priceChangePercent: item.unitPrice > 0 ? (priceDiff / item.unitPrice) * 100 : 0,
      message: status === "price_changed" 
        ? (priceDiff > 0 ? `Price increased by $${priceDiff.toFixed(2)}` : `Price decreased by $${Math.abs(priceDiff).toFixed(2)}`)
        : undefined,
    };
  }
  
  // Try Wheel-1 fallback
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT sku, brand, name, description, msrp, map_price, has_map,
            diameter, wheel_width, offset_mm, pcd1,
            image1, image1_source
     FROM wheel1_products WHERE sku = $1 AND is_discontinued = FALSE`,
    [item.sku]
  );
  
  if (rows.length > 0) {
    const w = rows[0];
    const msrpNum = w.msrp ? Number(w.msrp) : null;
    const mapNum = w.map_price && Number(w.map_price) > 0 ? Number(w.map_price) : null;
    const currentPrice = calculateWheelSellPrice({ sku: w.sku, map: mapNum, msrp: msrpNum });
    
    // Wheel-1 doesn't have real-time inventory, assume available
    const priceDiff = currentPrice - item.unitPrice;
    const status: ItemValidationStatus = Math.abs(priceDiff) < 0.01 ? "unchanged" : "price_changed";
    
    return {
      ...baseResult,
      status,
      currentItem: {
        sku: w.sku,
        brand: w.brand,
        model: w.name || w.description || w.sku,
        unitPrice: currentPrice,
        availableQty: 4, // Synthetic availability for Wheel-1
        supplier: "wheel1",
        imageUrl: w.image1 || w.image1_source,
      },
      currentUnitPrice: currentPrice,
      currentAvailableQty: 4,
      priceDifference: priceDiff,
      priceChangePercent: item.unitPrice > 0 ? (priceDiff / item.unitPrice) * 100 : 0,
      message: status === "price_changed"
        ? (priceDiff > 0 ? `Price increased by $${priceDiff.toFixed(2)}` : `Price decreased by $${Math.abs(priceDiff).toFixed(2)}`)
        : undefined,
    };
  }
  
  // Not found
  return {
    ...baseResult,
    status: "unavailable",
    message: "This wheel is no longer available",
    unavailableReason: "discontinued",
  };
}

// ============================================================================
// Tire Validation
// ============================================================================

async function validateTire(
  item: SavedQuoteItem,
  _vehicleResult: VehicleValidationResult
): Promise<ValidatedItem> {
  const baseResult: ValidatedItem = {
    savedItem: item,
    status: "needs_review",
    savedUnitPrice: item.unitPrice,
    savedQty: item.quantity,
  };
  
  // Get tire size from saved item
  const tireSize = item.size;
  if (!tireSize) {
    return {
      ...baseResult,
      status: "unavailable",
      message: "Cannot validate tire - size information missing",
      unavailableReason: "not_found",
    };
  }
  
  // Search for tire by size to get current pricing
  // We'll use internal fetch to reuse existing tire search logic
  try {
    const searchUrl = new URL(`${BASE_URL}/api/tires/search`);
    searchUrl.searchParams.set("size", tireSize);
    searchUrl.searchParams.set("limit", "100"); // Get more results to find the exact SKU
    
    const response = await fetch(searchUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    
    if (!response.ok) {
      throw new Error(`Tire search failed: ${response.status}`);
    }
    
    const data = await response.json();
    const tires: Array<{
      sku: string;
      brand: string;
      model: string;
      sellPrice: number;
      inStock: boolean;
      imageUrl?: string;
      source?: string;
    }> = data.tires || [];
    
    // Find matching tire by SKU
    const match = tires.find(t => t.sku === item.sku);
    
    if (!match) {
      // Try to find by brand + model as fallback
      const brandModelMatch = tires.find(t => 
        t.brand.toLowerCase() === item.brand.toLowerCase() &&
        t.model.toLowerCase() === item.model.toLowerCase()
      );
      
      if (brandModelMatch) {
        // Found by brand/model but different SKU - treat as substituted/needs review
        const priceDiff = brandModelMatch.sellPrice - item.unitPrice;
        return {
          ...baseResult,
          status: "price_changed", // Or could be "substituted" if we add that status
          currentItem: {
            sku: brandModelMatch.sku,
            brand: brandModelMatch.brand,
            model: brandModelMatch.model,
            unitPrice: brandModelMatch.sellPrice,
            availableQty: brandModelMatch.inStock ? 100 : 0, // TireWeb doesn't give exact qty
            supplier: brandModelMatch.source || "tireweb",
            imageUrl: brandModelMatch.imageUrl,
          },
          currentUnitPrice: brandModelMatch.sellPrice,
          currentAvailableQty: brandModelMatch.inStock ? 100 : 0,
          priceDifference: priceDiff,
          priceChangePercent: item.unitPrice > 0 ? (priceDiff / item.unitPrice) * 100 : 0,
          message: `Price ${priceDiff >= 0 ? 'increased' : 'decreased'} by $${Math.abs(priceDiff).toFixed(2)}`,
        };
      }
      
      return {
        ...baseResult,
        status: "unavailable",
        message: `${item.brand} ${item.model} in size ${tireSize} is no longer available`,
        unavailableReason: "discontinued",
      };
    }
    
    // Check availability
    if (!match.inStock) {
      return {
        ...baseResult,
        status: "unavailable",
        currentItem: {
          sku: match.sku,
          brand: match.brand,
          model: match.model,
          unitPrice: match.sellPrice,
          availableQty: 0,
          supplier: match.source || "tireweb",
          imageUrl: match.imageUrl,
        },
        currentUnitPrice: match.sellPrice,
        currentAvailableQty: 0,
        message: "This tire is currently out of stock",
        unavailableReason: "out_of_stock",
      };
    }
    
    // Price comparison
    const priceDiff = match.sellPrice - item.unitPrice;
    const status: ItemValidationStatus = Math.abs(priceDiff) < 0.01 ? "unchanged" : "price_changed";
    
    return {
      ...baseResult,
      status,
      currentItem: {
        sku: match.sku,
        brand: match.brand,
        model: match.model,
        unitPrice: match.sellPrice,
        availableQty: 100, // TireWeb doesn't provide exact qty
        supplier: match.source || "tireweb",
        imageUrl: match.imageUrl,
      },
      currentUnitPrice: match.sellPrice,
      currentAvailableQty: 100,
      priceDifference: priceDiff,
      priceChangePercent: item.unitPrice > 0 ? (priceDiff / item.unitPrice) * 100 : 0,
      message: status === "price_changed"
        ? (priceDiff > 0 ? `Price increased by $${priceDiff.toFixed(2)}` : `Price decreased by $${Math.abs(priceDiff).toFixed(2)}`)
        : undefined,
    };
  } catch (err) {
    console.error(`[resumeService] Tire validation error for ${item.sku}:`, err);
    return {
      ...baseResult,
      status: "unavailable",
      message: "Failed to check tire availability",
      unavailableReason: "supplier_error",
    };
  }
}

// ============================================================================
// Accessory Validation
// ============================================================================

async function validateAccessory(item: SavedQuoteItem): Promise<ValidatedItem> {
  const baseResult: ValidatedItem = {
    savedItem: item,
    status: "needs_review",
    savedUnitPrice: item.unitPrice,
    savedQty: item.quantity,
  };
  
  // Query accessories table directly
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT sku, title, brand, brand_code, category, sub_type,
              sell_price, msrp, image_url, in_stock
       FROM accessories WHERE sku = $1`,
      [item.sku]
    );
    
    if (rows.length === 0) {
      return {
        ...baseResult,
        status: "unavailable",
        message: "This accessory is no longer available",
        unavailableReason: "discontinued",
      };
    }
    
    const acc = rows[0];
    const currentPrice = acc.sell_price || acc.msrp || 0;
    
    if (!acc.in_stock) {
      return {
        ...baseResult,
        status: "unavailable",
        currentItem: {
          sku: acc.sku,
          brand: acc.brand || "Unknown",
          model: acc.title || acc.sku,
          unitPrice: currentPrice,
          availableQty: 0,
          imageUrl: acc.image_url,
        },
        currentUnitPrice: currentPrice,
        currentAvailableQty: 0,
        message: "This accessory is currently out of stock",
        unavailableReason: "out_of_stock",
      };
    }
    
    const priceDiff = currentPrice - item.unitPrice;
    const status: ItemValidationStatus = Math.abs(priceDiff) < 0.01 ? "unchanged" : "price_changed";
    
    return {
      ...baseResult,
      status,
      currentItem: {
        sku: acc.sku,
        brand: acc.brand || "Unknown",
        model: acc.title || acc.sku,
        unitPrice: currentPrice,
        availableQty: 100, // Accessories don't track exact qty
        imageUrl: acc.image_url,
      },
      currentUnitPrice: currentPrice,
      currentAvailableQty: 100,
      priceDifference: priceDiff,
      priceChangePercent: item.unitPrice > 0 ? (priceDiff / item.unitPrice) * 100 : 0,
      message: status === "price_changed"
        ? (priceDiff > 0 ? `Price increased by $${priceDiff.toFixed(2)}` : `Price decreased by $${Math.abs(priceDiff).toFixed(2)}`)
        : undefined,
    };
  } catch (err) {
    console.error(`[resumeService] Accessory validation error for ${item.sku}:`, err);
    return {
      ...baseResult,
      status: "unavailable",
      message: "Failed to check accessory availability",
      unavailableReason: "supplier_error",
    };
  }
}

// ============================================================================
// Pricing Calculation
// ============================================================================

function calculateCurrentPricing(
  savedPricing: SavedQuoteSnapshot["pricing"],
  validatedItems: ValidatedItem[]
): CurrentPricingSummary {
  // Calculate current subtotal from validated items
  const currentSubtotal = validatedItems.reduce((sum, vi) => {
    if (vi.currentItem && vi.status !== "unavailable" && vi.status !== "fitment_failed") {
      return sum + (vi.currentItem.unitPrice * vi.savedQty);
    }
    return sum;
  }, 0);
  
  // Estimate tax (using same rate as saved quote)
  const currentTaxEstimate = savedPricing.taxRate > 0 
    ? currentSubtotal * savedPricing.taxRate 
    : null;
  
  // Shipping estimate - keep saved estimate for now (would need address to recalculate)
  const currentShippingEstimate = savedPricing.estimatedShipping;
  
  // Check if saved discount would still apply (simplified - would need promo validation logic)
  let currentDiscount: CurrentPricingSummary["currentDiscount"] = null;
  if (savedPricing.discount) {
    // For now, assume saved discounts are expired
    // In production, would call discount validation API
    currentDiscount = {
      ...savedPricing.discount,
      expired: true,
    };
  }
  
  // Calculate current total
  const currentTotal = currentSubtotal + 
    (currentTaxEstimate || 0) + 
    (currentShippingEstimate || 0) -
    (currentDiscount?.expired === false ? currentDiscount.amount : 0);
  
  return {
    savedSubtotal: savedPricing.partsSubtotal + savedPricing.servicesSubtotal,
    savedTax: savedPricing.estimatedTax,
    savedShipping: savedPricing.estimatedShipping,
    savedDiscount: savedPricing.discount,
    savedTotal: savedPricing.total,
    currentSubtotal,
    currentTaxEstimate: currentTaxEstimate ?? undefined,
    currentShippingEstimate,
    currentDiscount,
    currentTotal,
    subtotalDifference: currentSubtotal - (savedPricing.partsSubtotal + savedPricing.servicesSubtotal),
    totalDifference: currentTotal - savedPricing.total,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if two bolt patterns are compatible
 * Handles formats like "5x114.3", "5x4.5", "5x114.3/5x120" (dual pattern)
 */
function boltPatternsMatch(wheelPattern: string, vehiclePattern: string): boolean {
  const normalize = (p: string) => p.toLowerCase().replace(/\s+/g, "");
  const wp = normalize(wheelPattern);
  const vp = normalize(vehiclePattern);
  
  // Exact match
  if (wp === vp) return true;
  
  // Check dual patterns (e.g., "5x114.3/5x120")
  const wpPatterns = wp.split("/");
  const vpPatterns = vp.split("/");
  
  // Any wheel pattern matches any vehicle pattern
  for (const w of wpPatterns) {
    for (const v of vpPatterns) {
      if (w === v) return true;
      
      // Handle metric/imperial conversion (e.g., 5x4.5 = 5x114.3)
      const wNorm = convertToMetric(w);
      const vNorm = convertToMetric(v);
      if (wNorm === vNorm) return true;
    }
  }
  
  return false;
}

/**
 * Convert imperial bolt pattern to metric
 * e.g., "5x4.5" → "5x114.3"
 */
function convertToMetric(pattern: string): string {
  const match = pattern.match(/^(\d+)x([\d.]+)$/);
  if (!match) return pattern;
  
  const bolts = match[1];
  const spacing = parseFloat(match[2]);
  
  // If already metric (> 50), return as-is
  if (spacing > 50) return pattern;
  
  // Convert inches to mm
  const metricSpacing = (spacing * 25.4).toFixed(1);
  return `${bolts}x${metricSpacing}`;
}
