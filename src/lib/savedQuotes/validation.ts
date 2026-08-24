/**
 * Saved Quote Validation & Sanitization
 * 
 * Server-side validation of client-submitted quote data.
 * Never trust arbitrary CartItem snapshots from the browser.
 * 
 * @created 2026-08-24
 */

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
 * Verify and compute pricing using existing commerce helpers
 * This ensures saved quotes reflect what WTD actually showed
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
  
  for (const item of items) {
    let verifiedPrice = clientPrices?.[item.sku] ?? item.unitPrice;
    
    // For tires and wheels, verify against our actual pricing
    if (item.type === "tire") {
      try {
        const price = await lookupTirePrice(item.sku);
        if (price !== null) {
          verifiedPrice = price;
        }
      } catch {
        // Fall back to client price if lookup fails
      }
    } else if (item.type === "wheel") {
      try {
        const price = await lookupWheelPrice(item.sku);
        if (price !== null) {
          verifiedPrice = price;
        }
      } catch {
        // Fall back to client price if lookup fails
      }
    }
    
    // Ensure price is a valid positive number
    verifiedPrice = Math.max(0, Number(verifiedPrice) || 0);
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
 * Lookup tire price from our pricing service
 */
async function lookupTirePrice(sku: string): Promise<number | null> {
  try {
    // Use internal API to get current price
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "http://localhost:3001";
    
    const res = await fetch(
      `${baseUrl}/api/tires/search?partNumber=${encodeURIComponent(sku)}&limit=1`,
      { cache: "no-store" }
    );
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return null;
    
    // Use sell price or cost + margin
    const sellPrice = typeof result.price === "number" && result.price > 0 ? result.price : null;
    const cost = typeof result.cost === "number" && result.cost > 0 ? result.cost : null;
    
    return sellPrice || (cost ? cost + 50 : null);
  } catch {
    return null;
  }
}

/**
 * Lookup wheel price from our pricing service
 */
async function lookupWheelPrice(sku: string): Promise<number | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "http://localhost:3001";
    
    const res = await fetch(
      `${baseUrl}/api/search?q=${encodeURIComponent(sku)}&limit=1`,
      { cache: "no-store" }
    );
    
    if (!res.ok) return null;
    
    const data = await res.json();
    // Extract price from search results
    const result = data?.wheels?.[0];
    if (!result) return null;
    
    return typeof result.price === "number" ? result.price : null;
  } catch {
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
