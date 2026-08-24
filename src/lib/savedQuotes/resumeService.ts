/**
 * Saved Quote Resume/Revalidation Service
 * 
 * Revalidates a saved quote snapshot against current commerce state.
 * Does NOT mutate the saved quote - returns comparison results only.
 * 
 * REUSES existing commerce systems:
 * - buildFitmentProfile + evaluateWheel for wheel fitment (vehicleFitment.ts)
 * - getTechfeedWheelBySku + calculateWheelSellPrice for wheel pricing
 * - /api/tires/search for tire lookup + pricing
 * - firstOrderService.validateDiscount / campaignDiscountService for promos
 * - Direct DB for accessories
 * 
 * DOES NOT create new pricing/inventory/fitment engines.
 * 
 * @created 2026-08-24
 * @updated 2026-08-24 - B5 fixes per review requirements
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
import { 
  getPool, 
  buildFitmentProfile, 
  evaluateWheel,
  type WheelToValidate,
  type FitmentProfile,
} from "@/lib/vehicleFitment";
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { calculateWheelSellPrice, resolveWheelMsrp } from "@/lib/pricing";
import { getInventoryForSku } from "@/lib/inventoryCache";
import { firstOrderService } from "@/lib/discounts/firstOrderService";
import { campaignDiscountService } from "@/lib/discounts/campaignDiscountService";

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
  
  // 1. Validate vehicle and get fitment profile
  const vehicleResult = await validateVehicle(snapshot.vehicle);
  
  if (!vehicleResult.valid) {
    warnings.push({
      code: "vehicle_invalid",
      severity: "error",
      message: vehicleResult.reason || "Vehicle configuration is no longer valid",
    });
  }
  
  // 2. Validate each item using FULL fitment validation for wheels
  const validatedItems = await Promise.all(
    snapshot.items.map(item => validateItem(item, snapshot.vehicle, vehicleResult))
  );
  
  // 3. Check for blocking conditions
  const unavailableItems = validatedItems.filter(vi => vi.status === "unavailable");
  const insufficientQtyItems = validatedItems.filter(vi => vi.status === "insufficient_quantity");
  const fitmentFailures = validatedItems.filter(vi => vi.status === "fitment_failed");
  const priceChanges = validatedItems.filter(vi => vi.status === "price_changed");
  
  // 4. Revalidate discount/promotion
  const discountResult = await revalidateDiscount(snapshot.pricing.discount);
  
  if (discountResult.status === "expired") {
    warnings.push({
      code: "discount_expired",
      severity: "warning",
      message: `Your saved discount (${snapshot.pricing.discount?.code}) has expired`,
    });
  } else if (discountResult.status === "invalid") {
    warnings.push({
      code: "discount_invalid",
      severity: "warning",
      message: `Your saved discount (${snapshot.pricing.discount?.code}) is no longer valid`,
    });
  }
  
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
  
  // 6. Add warnings for insufficient quantity (these BLOCK continuation)
  for (const item of insufficientQtyItems) {
    warnings.push({
      code: "insufficient_quantity",
      severity: "error",
      message: `Only ${item.currentAvailableQty} of ${item.savedQty} available for ${item.savedItem.brand} ${item.savedItem.model}`,
      itemSku: item.savedItem.sku,
    });
  }
  
  // 7. Calculate current pricing (with proper shipping/tax handling)
  const pricing = calculateCurrentPricing(snapshot.pricing, validatedItems, discountResult);
  
  // 8. Determine if user can continue
  // Insufficient quantity BLOCKS continuation (per requirements)
  const canContinue = unavailableItems.length === 0 && 
                      insufficientQtyItems.length === 0 &&
                      fitmentFailures.length === 0 &&
                      vehicleResult.valid;
  
  let continueBlockedReason: string | undefined;
  if (!canContinue) {
    if (!vehicleResult.valid) {
      continueBlockedReason = "Vehicle configuration is no longer valid";
    } else if (unavailableItems.length > 0) {
      continueBlockedReason = `${unavailableItems.length} item(s) are no longer available`;
    } else if (insufficientQtyItems.length > 0) {
      continueBlockedReason = `${insufficientQtyItems.length} item(s) have insufficient quantity available`;
    } else if (fitmentFailures.length > 0) {
      continueBlockedReason = `${fitmentFailures.length} item(s) no longer fit your vehicle`;
    }
  }
  
  // 9. Build cart preview (only if can continue)
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
      // Tax and shipping are PENDING - not estimated from old data
      estimatedTax: null,
      estimatedShipping: null,
      // Total cannot be accurately calculated without address
      total: null,
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
// Vehicle Validation (builds fitment profile for wheel validation)
// ============================================================================

async function validateVehicle(vehicle: SavedQuoteVehicle): Promise<VehicleValidationResult> {
  try {
    const year = parseInt(vehicle.year, 10);
    if (isNaN(year)) {
      return { valid: false, reason: "Invalid vehicle year" };
    }
    
    // Use Universal Fitment Resolver for basic vehicle lookup
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
    
    // Build full fitment profile for wheel validation
    const pool = getPool();
    const fitmentProfile = await buildFitmentProfile(
      pool,
      year,
      vehicle.make,
      vehicle.model,
      vehicle.trim
    );
    
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
      // Store the full profile for wheel validation
      _fitmentProfile: fitmentProfile,
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
  vehicle: SavedQuoteVehicle,
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
      return await validateWheel(item, vehicle, vehicleResult);
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
// Wheel Validation - Uses FULL existing fitment validation
// ============================================================================

async function validateWheel(
  item: SavedQuoteItem,
  vehicle: SavedQuoteVehicle,
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
    
    // Check availability - INSUFFICIENT QUANTITY BLOCKS CONTINUATION
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
        // Insufficient quantity - BLOCKS continuation (not partial fulfillment)
        return {
          ...baseResult,
          status: "insufficient_quantity",
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
    
    // FULL FITMENT VALIDATION using existing vehicleFitment.ts evaluateWheel
    const fitmentProfile = (vehicleResult as any)._fitmentProfile as FitmentProfile | null;
    
    if (fitmentProfile) {
      const wheelToValidate: WheelToValidate = {
        sku: wheel.sku,
        boltPattern: wheel.bolt_pattern_metric || wheel.bolt_pattern_standard,
        centerBore: wheel.centerbore ? Number(wheel.centerbore) : undefined,
        diameter: wheel.diameter ? Number(wheel.diameter) : undefined,
        width: wheel.width ? Number(wheel.width) : undefined,
        offset: wheel.offset ? Number(wheel.offset) : undefined,
      };
      
      const fitmentResult = evaluateWheel(wheelToValidate, fitmentProfile);
      
      if (fitmentResult.fitmentClass === "excluded") {
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
          message: fitmentResult.exclusionReasons.join("; "),
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
            diameter, wheel_width, offset_mm, pcd1, hub,
            image1, image1_source
     FROM wheel1_products WHERE sku = $1 AND is_discontinued = FALSE`,
    [item.sku]
  );
  
  if (rows.length > 0) {
    const w = rows[0];
    const msrpNum = w.msrp ? Number(w.msrp) : null;
    const mapNum = w.map_price && Number(w.map_price) > 0 ? Number(w.map_price) : null;
    const currentPrice = calculateWheelSellPrice({ sku: w.sku, map: mapNum, msrp: msrpNum });
    
    // Wheel-1 fitment validation
    const fitmentProfile = (vehicleResult as any)._fitmentProfile as FitmentProfile | null;
    
    if (fitmentProfile) {
      const wheelToValidate: WheelToValidate = {
        sku: w.sku,
        boltPattern: w.pcd1,
        centerBore: w.hub ? Number(w.hub) : undefined,
        diameter: w.diameter ? Number(w.diameter) : undefined,
        width: w.wheel_width ? Number(w.wheel_width) : undefined,
        offset: w.offset_mm ? Number(w.offset_mm) : undefined,
      };
      
      const fitmentResult = evaluateWheel(wheelToValidate, fitmentProfile);
      
      if (fitmentResult.fitmentClass === "excluded") {
        return {
          ...baseResult,
          status: "fitment_failed",
          currentItem: {
            sku: w.sku,
            brand: w.brand,
            model: w.name || w.description || w.sku,
            unitPrice: currentPrice,
            availableQty: 4, // Synthetic for Wheel-1
            supplier: "wheel1",
          },
          currentUnitPrice: currentPrice,
          currentAvailableQty: 4,
          message: fitmentResult.exclusionReasons.join("; "),
        };
      }
    }
    
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
// Tire Validation - Uses same tire search API as normal shopping
// ============================================================================

/**
 * Tire search result from /api/tires/search
 * Matches the actual API response structure
 */
interface TireSearchResult {
  partNumber: string;        // Primary identifier
  mfgPartNumber: string;     // Manufacturer part number
  brand: string;
  model: string;
  price: number;             // Sell price (cost + margin)
  cost: number | null;
  quantity: {                // Stock levels
    primary: number;
    alternate: number;
    national: number;
  };
  imageUrl: string | null;
  size: string;
  source: string;            // e.g. "tireweb:km", "tireweb:atd"
}

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
  
  const tireSize = item.size;
  if (!tireSize) {
    return {
      ...baseResult,
      status: "unavailable",
      message: "Cannot validate tire - size information missing",
      unavailableReason: "not_found",
    };
  }
  
  try {
    // Use the same tire search API as normal shopping
    // Include both size and partNumber for precise matching
    const searchUrl = new URL(`${BASE_URL}/api/tires/search`);
    searchUrl.searchParams.set("size", tireSize);
    searchUrl.searchParams.set("partNumber", item.sku);
    searchUrl.searchParams.set("limit", "1");
    
    const response = await fetch(searchUrl.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    
    if (!response.ok) {
      throw new Error(`Tire search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API-level errors
    if (data.error) {
      console.warn(`[validateTire] API error for ${item.sku}:`, data.error);
      throw new Error(data.error);
    }
    
    // API response uses 'results' not 'tires'
    const results: TireSearchResult[] = data.results || [];
    
    // Find exact match by partNumber or mfgPartNumber
    let match = results.find(t => 
      t.partNumber === item.sku || t.mfgPartNumber === item.sku
    );
    
    // If no exact match, try broader search by size and find by brand+model
    if (!match && results.length === 0) {
      const broaderUrl = new URL(`${BASE_URL}/api/tires/search`);
      broaderUrl.searchParams.set("size", tireSize);
      broaderUrl.searchParams.set("limit", "200");
      
      const broaderResponse = await fetch(broaderUrl.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      
      if (broaderResponse.ok) {
        const broaderData = await broaderResponse.json();
        const broaderResults: TireSearchResult[] = broaderData.results || [];
        
        // Try exact SKU match first
        match = broaderResults.find(t => 
          t.partNumber === item.sku || t.mfgPartNumber === item.sku
        );
        
        // Fallback to brand+model match
        if (!match) {
          match = broaderResults.find(t => 
            t.brand.toLowerCase() === item.brand.toLowerCase() &&
            t.model.toLowerCase() === item.model.toLowerCase()
          );
        }
      }
    }
    
    if (!match) {
      return {
        ...baseResult,
        status: "unavailable",
        message: `${item.brand} ${item.model} in size ${tireSize} is no longer available`,
        unavailableReason: "discontinued",
      };
    }
    
    // Calculate total available quantity from all warehouses
    const totalQty = (match.quantity?.primary || 0) + 
                     (match.quantity?.alternate || 0) + 
                     (match.quantity?.national || 0);
    const currentPrice = match.price;
    
    // Check if completely out of stock
    if (totalQty === 0) {
      return {
        ...baseResult,
        status: "unavailable",
        currentItem: {
          sku: match.partNumber,
          brand: match.brand,
          model: match.model,
          unitPrice: currentPrice,
          availableQty: 0,
          supplier: match.source || "tireweb",
          imageUrl: match.imageUrl || undefined,
        },
        currentUnitPrice: currentPrice,
        currentAvailableQty: 0,
        message: "This tire is currently out of stock",
        unavailableReason: "out_of_stock",
      };
    }
    
    // Check if insufficient quantity for the saved order
    if (totalQty < item.quantity) {
      return {
        ...baseResult,
        status: "insufficient_quantity",
        currentItem: {
          sku: match.partNumber,
          brand: match.brand,
          model: match.model,
          unitPrice: currentPrice,
          availableQty: totalQty,
          supplier: match.source || "tireweb",
          imageUrl: match.imageUrl || undefined,
        },
        currentUnitPrice: currentPrice,
        currentAvailableQty: totalQty,
        priceDifference: currentPrice - item.unitPrice,
        message: `Only ${totalQty} available (you saved ${item.quantity})`,
      };
    }
    
    // Price comparison
    const priceDiff = currentPrice - item.unitPrice;
    const status: ItemValidationStatus = Math.abs(priceDiff) < 0.01 ? "unchanged" : "price_changed";
    
    return {
      ...baseResult,
      status,
      currentItem: {
        sku: match.partNumber,
        brand: match.brand,
        model: match.model,
        unitPrice: currentPrice,
        availableQty: totalQty,
        supplier: match.source || "tireweb",
        imageUrl: match.imageUrl || undefined,
      },
      currentUnitPrice: currentPrice,
      currentAvailableQty: totalQty,
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
// Discount/Promotion Revalidation - Uses existing discount services
// ============================================================================

type DiscountRevalidationResult = {
  status: "valid" | "expired" | "invalid" | "none";
  currentDiscount?: {
    code: string;
    discountPercent: number;
    type: string;
  };
};

async function revalidateDiscount(
  savedDiscount?: { code: string; amount: number; type: string }
): Promise<DiscountRevalidationResult> {
  if (!savedDiscount || !savedDiscount.code) {
    return { status: "none" };
  }
  
  try {
    // Try first-order discount validation
    const firstOrderResult = await firstOrderService.validateDiscount(savedDiscount.code);
    
    if (firstOrderResult.valid) {
      return {
        status: "valid",
        currentDiscount: {
          code: savedDiscount.code,
          discountPercent: firstOrderResult.discountPercent || 10,
          type: "first_order",
        },
      };
    }
    
    // Check if explicitly expired
    if (firstOrderResult.expired) {
      return { status: "expired" };
    }
    
    // Try campaign discount
    const campaignResult = await campaignDiscountService.validateCampaignDiscount(savedDiscount.code);
    
    if (campaignResult.valid) {
      return {
        status: "valid",
        currentDiscount: {
          code: savedDiscount.code,
          discountPercent: campaignResult.discountPercent || 10,
          type: "campaign",
        },
      };
    }
    
    if (campaignResult.expired) {
      return { status: "expired" };
    }
    
    // Neither valid - treat as invalid
    return { status: "invalid" };
  } catch (err) {
    console.error("[resumeService] Discount validation error:", err);
    // On error, assume expired to be safe
    return { status: "expired" };
  }
}

// ============================================================================
// Pricing Calculation - Properly handles shipping/tax as pending
// ============================================================================

function calculateCurrentPricing(
  savedPricing: SavedQuoteSnapshot["pricing"],
  validatedItems: ValidatedItem[],
  discountResult: DiscountRevalidationResult
): CurrentPricingSummary {
  // Calculate current subtotal from validated items
  const currentSubtotal = validatedItems.reduce((sum, vi) => {
    if (vi.currentItem && vi.status !== "unavailable" && vi.status !== "fitment_failed" && vi.status !== "insufficient_quantity") {
      return sum + (vi.currentItem.unitPrice * vi.savedQty);
    }
    return sum;
  }, 0);
  
  // Current discount (only if still valid)
  let currentDiscount: CurrentPricingSummary["currentDiscount"] = null;
  if (discountResult.status === "valid" && discountResult.currentDiscount) {
    const discountAmount = currentSubtotal * (discountResult.currentDiscount.discountPercent / 100);
    currentDiscount = {
      code: discountResult.currentDiscount.code,
      amount: discountAmount,
      type: discountResult.currentDiscount.type,
      expired: false,
    };
  } else if (savedPricing.discount && discountResult.status !== "none") {
    // Discount was saved but is no longer valid
    currentDiscount = {
      code: savedPricing.discount.code,
      amount: 0,
      type: savedPricing.discount.type,
      expired: true,
    };
  }
  
  // Shipping: PENDING - cannot calculate without address
  // Do NOT carry over saved shipping as "current"
  const currentShippingEstimate: number | null = null; // PENDING
  
  // Tax: PENDING - cannot accurately calculate without address
  // Do NOT apply saved tax rate to current subtotal
  const currentTaxEstimate: number | null = null; // PENDING
  
  // Current total: subtotal - discount (shipping and tax pending at checkout)
  const subtotalAfterDiscount = currentSubtotal - (currentDiscount?.amount || 0);
  
  return {
    savedSubtotal: savedPricing.partsSubtotal + savedPricing.servicesSubtotal,
    savedTax: savedPricing.estimatedTax,
    savedShipping: savedPricing.estimatedShipping,
    savedDiscount: savedPricing.discount,
    savedTotal: savedPricing.total,
    
    // Current values
    currentSubtotal,
    currentTaxEstimate: undefined, // Pending
    currentShippingEstimate: null, // Pending
    currentDiscount,
    
    // Current total is merchandise subtotal only (tax/shipping pending)
    currentTotal: subtotalAfterDiscount,
    
    // Show differences in merchandise value
    subtotalDifference: currentSubtotal - (savedPricing.partsSubtotal + savedPricing.servicesSubtotal),
    
    // Total difference only reflects merchandise (tax/shipping will be at checkout)
    totalDifference: subtotalAfterDiscount - savedPricing.total,
    
    // Flags to indicate what's pending
    shippingPending: true,
    taxPending: true,
  };
}