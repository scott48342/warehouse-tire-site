/**
 * Accessory Auto-Add Module
 * 
 * Safe, fail-soft accessory auto-add with:
 * - Feature flag control
 * - Strict validation
 * - Instrumentation
 * - Never crashes main cart flow
 */

import type { CartAccessoryItem } from "./accessoryTypes";

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE FLAG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Feature flag for accessory auto-add.
 * Set to false to instantly disable without code changes.
 * Can also be controlled via localStorage for testing: localStorage.setItem('DISABLE_ACCESSORY_AUTO_ADD', 'true')
 */
export const ENABLE_ACCESSORY_AUTO_ADD = true;

/**
 * Check if accessory auto-add is enabled.
 * Respects both the code flag and localStorage override.
 */
export function isAccessoryAutoAddEnabled(): boolean {
  if (!ENABLE_ACCESSORY_AUTO_ADD) return false;
  
  // Allow runtime disable via localStorage (for emergency kill switch)
  if (typeof window !== "undefined") {
    try {
      if (localStorage.getItem("DISABLE_ACCESSORY_AUTO_ADD") === "true") {
        console.log("[accessoryAutoAdd] Disabled via localStorage kill switch");
        return false;
      }
    } catch {
      // Ignore localStorage errors
    }
  }
  
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTRUMENTATION
// ═══════════════════════════════════════════════════════════════════════════

type AccessoryAutoAddEvent = 
  | "accessory_auto_add_attempt"
  | "accessory_auto_add_success"
  | "accessory_auto_add_skipped_invalid"
  | "accessory_auto_add_skipped_disabled"
  | "accessory_auto_add_failed";

interface AccessoryAutoAddEventData {
  wheelSku: string;
  accessorySku?: string;
  category?: string;
  reason?: string;
  error?: string;
  validationErrors?: string[];
}

/**
 * Log accessory auto-add events for debugging and monitoring.
 */
export function logAccessoryEvent(
  event: AccessoryAutoAddEvent,
  data: AccessoryAutoAddEventData
): void {
  const timestamp = new Date().toISOString();
  const logEntry = { event, timestamp, ...data };
  
  // Console logging for debugging
  const prefix = "[accessoryAutoAdd]";
  switch (event) {
    case "accessory_auto_add_attempt":
      console.log(`${prefix} Attempting auto-add:`, logEntry);
      break;
    case "accessory_auto_add_success":
      console.log(`${prefix} ✓ Success:`, logEntry);
      break;
    case "accessory_auto_add_skipped_invalid":
      console.warn(`${prefix} ⚠ Skipped (invalid):`, logEntry);
      break;
    case "accessory_auto_add_skipped_disabled":
      console.log(`${prefix} Skipped (disabled):`, logEntry);
      break;
    case "accessory_auto_add_failed":
      console.error(`${prefix} ✗ Failed:`, logEntry);
      break;
  }
  
  // TODO: Add analytics/telemetry here if needed
  // e.g., window.gtag?.('event', event, data);
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

export interface AccessoryValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: CartAccessoryItem | null;
}

/**
 * Strictly validate an accessory item before adding to cart.
 * Returns sanitized item if valid, null if invalid.
 */
export function validateAccessoryItem(
  item: Partial<CartAccessoryItem> | null | undefined,
  wheelSku: string
): AccessoryValidationResult {
  const errors: string[] = [];
  
  // Null/undefined check
  if (!item) {
    errors.push("Item is null or undefined");
    return { valid: false, errors, sanitized: null };
  }
  
  // Required: type must be "accessory"
  if (item.type !== "accessory") {
    errors.push(`Invalid type: expected "accessory", got "${item.type}"`);
  }
  
  // Required: sku must be non-empty string
  if (!item.sku || typeof item.sku !== "string" || item.sku.trim() === "") {
    errors.push("Missing or invalid sku");
  }
  
  // Required: name must be non-empty string
  if (!item.name || typeof item.name !== "string" || item.name.trim() === "") {
    errors.push("Missing or invalid name");
  }
  
  // Required: unitPrice must be a valid finite number >= 0
  if (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
    errors.push(`Invalid unitPrice: ${item.unitPrice} (must be finite number >= 0)`);
  }
  
  // Required: quantity must be a positive integer
  if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity < 1 || !Number.isInteger(item.quantity)) {
    errors.push(`Invalid quantity: ${item.quantity} (must be positive integer)`);
  }
  
  // Required: category must be a valid accessory category
  const validCategories = ["lug_nut", "lug_bolt", "hub_ring", "valve_stem", "tpms"];
  if (!item.category || !validCategories.includes(item.category)) {
    errors.push(`Invalid category: "${item.category}" (must be one of: ${validCategories.join(", ")})`);
  }
  
  // If any errors, return invalid
  if (errors.length > 0) {
    logAccessoryEvent("accessory_auto_add_skipped_invalid", {
      wheelSku,
      accessorySku: item.sku ?? "(missing)",
      category: item.category,
      validationErrors: errors,
    });
    return { valid: false, errors, sanitized: null };
  }
  
  // Build sanitized item with all required fields
  const sanitized: CartAccessoryItem = {
    type: "accessory",
    sku: item.sku!.trim(),
    name: item.name!.trim(),
    unitPrice: item.unitPrice!,
    quantity: item.quantity!,
    category: item.category as CartAccessoryItem["category"],
    required: item.required ?? false,
    reason: item.reason ?? "",
    wheelSku: item.wheelSku ?? wheelSku,
    spec: item.spec,
    meta: item.meta,
  };
  
  return { valid: true, errors: [], sanitized };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFE AUTO-ADD
// ═══════════════════════════════════════════════════════════════════════════

export interface SafeAutoAddResult {
  attempted: number;
  added: number;
  skipped: number;
  failed: number;
  items: CartAccessoryItem[];
}

/**
 * Safely auto-add accessories to cart.
 * - Never throws
 * - Never blocks main cart flow
 * - Validates every item
 * - Logs all outcomes
 */
export function safeAutoAddAccessories(
  wheelSku: string,
  rawItems: Array<Partial<CartAccessoryItem> | null | undefined>,
  addAccessoryFn: (item: CartAccessoryItem) => void
): SafeAutoAddResult {
  const result: SafeAutoAddResult = {
    attempted: 0,
    added: 0,
    skipped: 0,
    failed: 0,
    items: [],
  };
  
  // Check feature flag first
  if (!isAccessoryAutoAddEnabled()) {
    logAccessoryEvent("accessory_auto_add_skipped_disabled", { wheelSku });
    return result;
  }
  
  // Filter out null/undefined before counting
  const itemsToProcess = rawItems.filter(Boolean);
  result.attempted = itemsToProcess.length;
  
  if (result.attempted === 0) {
    console.log("[accessoryAutoAdd] No accessories to add");
    return result;
  }
  
  logAccessoryEvent("accessory_auto_add_attempt", {
    wheelSku,
    reason: `Processing ${result.attempted} accessory items`,
  });
  
  for (const rawItem of itemsToProcess) {
    try {
      // Validate
      const validation = validateAccessoryItem(rawItem, wheelSku);
      
      if (!validation.valid || !validation.sanitized) {
        result.skipped++;
        continue;
      }
      
      // Add to cart
      addAccessoryFn(validation.sanitized);
      result.added++;
      result.items.push(validation.sanitized);
      
      logAccessoryEvent("accessory_auto_add_success", {
        wheelSku,
        accessorySku: validation.sanitized.sku,
        category: validation.sanitized.category,
      });
      
    } catch (error) {
      // Catch any unexpected errors - never let accessory add crash the flow
      result.failed++;
      logAccessoryEvent("accessory_auto_add_failed", {
        wheelSku,
        accessorySku: (rawItem as any)?.sku ?? "(unknown)",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  console.log(`[accessoryAutoAdd] Complete: ${result.added} added, ${result.skipped} skipped, ${result.failed} failed`);
  return result;
}
