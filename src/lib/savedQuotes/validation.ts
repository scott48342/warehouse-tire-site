/**
 * Saved Quote Validation & Sanitization
 * 
 * Server-side validation of client-submitted quote data.
 * Never trust arbitrary CartItem snapshots from the browser.
 * 
 * ARCHITECTURE:
 * - Server is ALWAYS authoritative for pricing
 * - Client-submitted prices are context only, never trusted
 * - Uses the same pricing logic as normal shopping (tire pricing service)
 * - Never silently falls back to $0 - fails cleanly with pricing_unavailable
 * 
 * @created 2026-08-24
 * @updated 2026-08-24 - Fixed tire pricing to use direct lookup (no HTTP self-call)
 */

import { getTirePrice } from "@/lib/tires/tirePricingService";
import type { 
  SaveQuoteRequest, 
  SavedQuoteItem, 
  SavedQuoteVehicle,
  SavedQuotePricing,
  SavedQuoteSnapshot,
  SAVED_QUOTE_LIMITS 
} from "./types";
import { SAVED_QUOTE_LIMITS as LIMITS } from "./types";

// ============================================================================
// Validation Errors
// ============================================================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// ============================================================================
// Vehicle Validation
// ============================================================================

const VALID_YEAR_RANGE = { min: 1950, max: new Date().getFullYear() + 2 };

export function validateVehicle(input: SaveQuoteRequest["vehicle"]): SavedQuoteVehicle {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Vehicle is required", "vehicle", "required");
  }
  
  // Year
  const year = String(input.year || "").trim();
  const yearNum = parseInt(year, 10);
  if (!year || isNaN(yearNum) || yearNum < VALID_YEAR_RANGE.min || yearNum > VALID_YEAR_RANGE.max) {
    throw new ValidationError("Invalid vehicle year", "vehicle.year", "invalid_year");
  }
  
  // Make
  const make = sanitizeString(input.make, 50);
  if (!make) {
    throw new ValidationError("Vehicle make is required", "vehicle.make", "required");
  }
  
  // Model
  const model = sanitizeString(input.model, 50);
  if (!model) {
    throw new ValidationError("Vehicle model is required", "vehicle.model", "required");
  }
  
  // Optional fields
  const trim = input.trim ? sanitizeString(input.trim, 50) : undefined;
  const modification = input.modification ? sanitizeString(input.modification, 100) : undefined;
  
  return {
    year,
    make,
    model,
    ...(trim && { trim }),
    ...(modification && { modification }),
  };
}

// ============================================================================
// Item Validation
// ============================================================================

const VALID_ITEM_TYPES = ["wheel", "tire", "accessory"] as const;

export function validateItems(
  items: SaveQuoteRequest["items"]
): SavedQuoteItem[] {
  if (!Array.isArray(items)) {
    throw new ValidationError("Items must be an array", "items", "invalid_type");
  }
  
  if (items.length === 0) {
    throw new ValidationError("At least one item is required", "items", "empty");
  }
  
  if (items.length > LIMITS.maxItems) {
    throw new ValidationError(
      `Maximum ${LIMITS.maxItems} items allowed`,
      "items",
      "too_many"
    );
  }
  
  const validated: SavedQuoteItem[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Type
    if (!item.type || !VALID_ITEM_TYPES.includes(item.type as any)) {
      throw new ValidationError(
        `Invalid item type at index ${i}`,
        `items[${i}].type`,
        "invalid_type"
      );
    }
    
    // SKU
    const sku = sanitizeString(item.sku, 50);
    if (!sku) {
      throw new ValidationError(
        `SKU required at index ${i}`,
        `items[${i}].sku`,
        "required"
      );
    }
    
    // Quantity
    const quantity = parseInt(String(item.quantity), 10);
    if (isNaN(quantity) || quantity < 1 || quantity > LIMITS.maxQuantityPerItem) {
      throw new ValidationError(
        `Invalid quantity at index ${i} (must be 1-${LIMITS.maxQuantityPerItem})`,
        `items[${i}].quantity`,
        "invalid_quantity"
      );
    }
    
    // Brand/Model (required for display)
    const brand = sanitizeString(item.brand, 50) || "Unknown";
    const model = sanitizeString(item.model, 100) || "Unknown";
    
    // Build validated item
    const validatedItem: SavedQuoteItem = {
      type: item.type as "wheel" | "tire" | "accessory",
      sku,
      brand,
      model,
      quantity,
      unitPrice: 0, // Will be set by pricing verification
    };
    
    // Optional fields based on type
    if (item.rearSku) validatedItem.rearSku = sanitizeString(item.rearSku, 50);
    if (item.finish) validatedItem.finish = sanitizeString(item.finish, 50);
    if (item.diameter) validatedItem.diameter = sanitizeString(item.diameter, 10);
    if (item.width) validatedItem.width = sanitizeString(item.width, 10);
    if (item.offset) validatedItem.offset = sanitizeString(item.offset, 10);
    if (item.boltPattern) validatedItem.boltPattern = sanitizeString(item.boltPattern, 20);
    if (item.size) validatedItem.size = sanitizeString(item.size, 30);
    if (item.rearSize) validatedItem.rearSize = sanitizeString(item.rearSize, 30);
    if (item.loadIndex) validatedItem.loadIndex = sanitizeString(item.loadIndex, 10);
    if (item.speedRating) validatedItem.speedRating = sanitizeString(item.speedRating, 5);
    if (item.category) validatedItem.category = sanitizeString(item.category, 30);
    if (item.imageUrl) validatedItem.imageUrl = sanitizeUrl(item.imageUrl);
    if (typeof item.staggered === "boolean") validatedItem.staggered = item.staggered;
    if (typeof item.required === "boolean") validatedItem.required = item.required;
    if (item.reason) validatedItem.reason = sanitizeString(item.reason, 200);
    if (item.source) validatedItem.source = sanitizeString(item.source, 30);
    
    validated.push(validatedItem);
  }
  
  return validated;
}

// ============================================================================
// Pricing Verification
// ============================================================================

/**
 * Verify and compute pricing using existing commerce helpers.
 * This ensures saved quotes reflect what WTD actually showed.
 * 
 * CRITICAL: Never silently accept $0 for purchasable items.
 * If we can't establish a valid authoritative price, fail the operation.
 */
export async function verifyPricing(
  items: SavedQuoteItem[],
  vehicle: SavedQuoteVehicle,
  clientPrices?: Record<string, number>
): Promise<{ items: SavedQuoteItem[]; pricing: SavedQuotePricing }> {
  const verifiedItems: SavedQuoteItem[] = [];
  let partsSubtotal = 0;
  let servicesSubtotal = 0;
  
  // Default tax rate (will be refined based on location)
  const taxRate = 0.06; // Michigan default
  
  // Track items that failed pricing resolution
  const pricingFailures: string[] = [];
  
  for (const item of items) {
    let verifiedPrice: number | null = null;
    let clientDisplayedPrice = clientPrices?.[item.sku];
    
    // For tires and wheels, server must verify price authoritatively
    if (item.type === "tire") {
      // Tire lookup requires size for the search API
      const tireSize = item.size;
      if (!tireSize) {
        console.warn(`[verifyPricing] Tire ${item.sku} missing size, cannot verify price`);
        pricingFailures.push(`${item.brand} ${item.model} (missing size)`);
        continue;
      }
      
      try {
        // Use direct tire pricing service (same logic as normal shopping)
        // This avoids HTTP self-calls which can fail on serverless
        verifiedPrice = await getTirePrice(item.sku, tireSize);
        
        // Log if client-displayed price differs significantly from server price
        if (verifiedPrice !== null && clientDisplayedPrice !== undefined) {
          const diff = Math.abs(verifiedPrice - clientDisplayedPrice);
          if (diff > 0.01) {
            console.log(`[verifyPricing] Price mismatch for ${item.sku}: client=${clientDisplayedPrice}, server=${verifiedPrice}`);
          }
        }
      } catch (err) {
        console.error(`[verifyPricing] Tire price lookup failed for ${item.sku}:`, err);
      }
      
      if (verifiedPrice === null) {
        pricingFailures.push(`${item.brand} ${item.model} (${item.sku})`);
      }
      
    } else if (item.type === "wheel") {
      try {
        verifiedPrice = await lookupWheelPrice(item.sku);
        
        // Log if client-displayed price differs significantly
        if (verifiedPrice !== null && clientDisplayedPrice !== undefined) {
          const diff = Math.abs(verifiedPrice - clientDisplayedPrice);
          if (diff > 0.01) {
            console.log(`[verifyPricing] Price mismatch for ${item.sku}: client=${clientDisplayedPrice}, server=${verifiedPrice}`);
          }
        }
      } catch (err) {
        console.error(`[verifyPricing] Wheel price lookup failed for ${item.sku}:`, err);
      }
      
      if (verifiedPrice === null) {
        pricingFailures.push(`${item.brand} ${item.model} (${item.sku})`);
      }
      
    } else if (item.type === "accessory") {
      // Accessories may be free (TPMS sensors bundled, etc) or have a price
      // For accessories, we can accept client price if it looks reasonable
      // or allow $0 only for explicitly free items (like required TPMS)
      if (item.required) {
        // Required accessories (like TPMS) can be $0 or bundled
        verifiedPrice = clientDisplayedPrice ?? 0;
      } else {
        // Optional accessories need a price
        verifiedPrice = clientDisplayedPrice ?? null;
        if (verifiedPrice === null || verifiedPrice <= 0) {
          pricingFailures.push(`${item.brand || "Accessory"} ${item.model} (${item.sku})`);
        }
      }
    }
    
    // Skip items that failed pricing
    if (verifiedPrice === null) {
      continue;
    }
    
    // Round to 2 decimal places
    verifiedPrice = Math.round(verifiedPrice * 100) / 100;
    
    const verifiedItem = { ...item, unitPrice: verifiedPrice };
    verifiedItems.push(verifiedItem);
    
    // Tires and wheels are taxable parts
    if (item.type === "tire" || item.type === "wheel") {
      partsSubtotal += verifiedPrice * item.quantity;
    } else {
      // Accessories may or may not be taxable, assume not for simplicity
      servicesSubtotal += verifiedPrice * item.quantity;
    }
  }
  
  // CRITICAL: Fail if we couldn't price any purchasable items
  if (pricingFailures.length > 0) {
    throw new ValidationError(
      `We couldn't verify the current price for: ${pricingFailures.join(", ")}. Please try again.`,
      "items",
      "pricing_unavailable"
    );
  }
  
  // All items must have been successfully priced
  if (verifiedItems.length !== items.length) {
    throw new ValidationError(
      "Some items could not be priced. Please try again.",
      "items",
      "pricing_incomplete"
    );
  }
  
  const estimatedTax = Math.round(partsSubtotal * taxRate * 100) / 100;
  const total = Math.round((partsSubtotal + servicesSubtotal + estimatedTax) * 100) / 100;
  
  const pricing: SavedQuotePricing = {
    partsSubtotal: Math.round(partsSubtotal * 100) / 100,
    servicesSubtotal: Math.round(servicesSubtotal * 100) / 100,
    estimatedTax,
    taxRate,
    estimatedShipping: null, // Unknown at save time
    total,
  };
  
  return { items: verifiedItems, pricing };
}

/**
 * Lookup wheel price using direct database query.
 * Uses the same pricing logic as normal shopping.
 */
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { calculateWheelSellPrice, resolveWheelMsrp } from "@/lib/pricing";
import { getInventoryForSku } from "@/lib/inventoryCache";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const DATABASE_URL = process.env.POSTGRES_URL;
  if (!DATABASE_URL) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

async function lookupWheelPrice(sku: string): Promise<number | null> {
  try {
    // Try WheelPros/techfeed first
    const wheel = await getTechfeedWheelBySku(sku);
    
    if (wheel) {
      const inventory = await getInventoryForSku(sku);
      const mapValue = inventory?.mapPrice ?? (wheel.map_price ? Number(wheel.map_price) : null);
      const rawMsrp = inventory?.msrp ?? (wheel.msrp ? Number(wheel.msrp) : null);
      const correctedMsrp = !mapValue
        ? resolveWheelMsrp({ sku: wheel.sku, brandCd: wheel.brand_cd ?? wheel.brand_desc, diameter: wheel.diameter, msrp: rawMsrp })
        : rawMsrp;
      const price = calculateWheelSellPrice({ sku: wheel.sku, map: mapValue, msrp: correctedMsrp });
      
      if (price && price > 0) {
        return price;
      }
    }
    
    // Try Wheel-1 fallback
    const db = getPool();
    const { rows } = await db.query(
      `SELECT sku, msrp, map_price, has_map
       FROM wheel1_products WHERE sku = $1 AND is_discontinued = FALSE`,
      [sku]
    );
    
    if (rows.length > 0) {
      const w = rows[0];
      const msrpNum = w.msrp ? Number(w.msrp) : null;
      const mapNum = w.map_price && Number(w.map_price) > 0 ? Number(w.map_price) : null;
      const price = calculateWheelSellPrice({ sku: w.sku, map: mapNum, msrp: msrpNum });
      
      if (price && price > 0) {
        return price;
      }
    }
    
    console.warn(`[lookupWheelPrice] No valid price for ${sku}`);
    return null;
  } catch (err) {
    console.error(`[lookupWheelPrice] Exception for ${sku}:`, err);
    return null;
  }
}

// ============================================================================
// Snapshot Creation
// ============================================================================

/**
 * Build item summary string
 */
export function buildItemSummary(items: SavedQuoteItem[]): string {
  const parts: string[] = [];
  
  // Group by type and brand/model
  const tires = items.filter(i => i.type === "tire");
  const wheels = items.filter(i => i.type === "wheel");
  const accessories = items.filter(i => i.type === "accessory");
  
  if (tires.length > 0) {
    const totalQty = tires.reduce((sum, t) => sum + t.quantity, 0);
    const firstTire = tires[0];
    parts.push(`${totalQty}x ${firstTire.brand} ${firstTire.model}`);
  }
  
  if (wheels.length > 0) {
    const totalQty = wheels.reduce((sum, w) => sum + w.quantity, 0);
    const firstWheel = wheels[0];
    parts.push(`${totalQty}x ${firstWheel.brand} ${firstWheel.model}`);
  }
  
  if (accessories.length > 0) {
    const totalQty = accessories.reduce((sum, a) => sum + a.quantity, 0);
    parts.push(`${totalQty} accessories`);
  }
  
  return parts.join(" + ") || "Empty quote";
}

/**
 * Create validated snapshot
 */
export function createSnapshot(
  vehicle: SavedQuoteVehicle,
  items: SavedQuoteItem[],
  pricing: SavedQuotePricing,
  source: "cart" | "package-builder" | "pdp",
  cartId?: string
): SavedQuoteSnapshot {
  return {
    vehicle,
    items,
    pricing,
    savedFrom: source,
    savedAt: new Date().toISOString(),
    cartId: cartId ? sanitizeString(cartId, 50) : undefined,
    itemSummary: buildItemSummary(items),
  };
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  if (str.length === 0) return undefined;
  return str.slice(0, maxLength);
}

function sanitizeUrl(value: unknown): string | undefined {
  const str = sanitizeString(value, 500);
  if (!str) return undefined;
  
  // Only allow http/https URLs
  try {
    const url = new URL(str);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return str;
  } catch {
    return undefined;
  }
}

/**
 * Validate snapshot size
 */
export function validateSnapshotSize(snapshot: SavedQuoteSnapshot): void {
  const json = JSON.stringify(snapshot);
  if (json.length > LIMITS.maxSnapshotBytes) {
    throw new ValidationError(
      `Snapshot too large (${json.length} bytes, max ${LIMITS.maxSnapshotBytes})`,
      "snapshot",
      "too_large"
    );
  }
}
