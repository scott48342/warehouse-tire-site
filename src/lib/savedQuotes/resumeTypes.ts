/**
 * Resume/Revalidation Types for Saved Quotes
 * 
 * Defines the structured result of revalidating a saved quote
 * against current commerce state.
 * 
 * @created 2026-08-24
 */

import type { SavedQuoteItem, SavedQuoteVehicle, SavedQuotePricing } from "./types";

// ============================================================================
// Item Validation Status
// ============================================================================

export type ItemValidationStatus =
  | "unchanged"             // Same price, available, fits
  | "price_changed"         // Available but price different
  | "unavailable"           // Cannot fulfill (out of stock, discontinued)
  | "fitment_failed"        // No longer fits the vehicle
  | "insufficient_quantity" // Requested quantity not available (BLOCKS continuation)
  | "needs_review"          // Requires manual review (ambiguous state)
  ;

// ============================================================================
// Validated Item Result
// ============================================================================

export interface ValidatedItem {
  // Identity (from saved)
  savedItem: SavedQuoteItem;
  
  // Current state (from commerce system)
  currentItem?: {
    sku: string;
    brand: string;
    model: string;
    unitPrice: number;
    availableQty: number;
    supplier?: string;
    imageUrl?: string;
    // Additional specs as needed
  } | null;
  
  // Validation result
  status: ItemValidationStatus;
  
  // Price comparison
  savedUnitPrice: number;
  currentUnitPrice?: number;
  priceDifference?: number;  // Positive = price increased
  priceChangePercent?: number;
  
  // Quantity comparison
  savedQty: number;
  currentAvailableQty?: number;
  
  // Human-readable message
  message?: string;
  
  // For unavailable items: reason code
  unavailableReason?: "out_of_stock" | "discontinued" | "not_found" | "supplier_error";
}

// ============================================================================
// Vehicle Validation Result
// ============================================================================

export interface VehicleValidationResult {
  valid: boolean;
  reason?: string;
  
  // Resolved fitment data (if valid)
  fitmentData?: {
    boltPattern: string | null;
    centerBore: number | null;
    threadSize: string | null;
    lugSeatType: string | null;
    oemTireSizes: string[];
    wheelDiameterRange: { min: number; max: number } | null;
  };
  
  // Internal: full fitment profile for wheel validation (not exposed in API response)
  _fitmentProfile?: unknown;
}

// ============================================================================
// Pricing Summary
// ============================================================================

export interface CurrentPricingSummary {
  // From saved quote (historical)
  savedSubtotal: number;
  savedTax: number;
  savedShipping: number | null;
  savedDiscount?: { code: string; amount: number; type: string };
  savedTotal: number;
  
  // Current (revalidated)
  currentSubtotal?: number;
  currentTaxEstimate?: number;              // undefined = pending/unknown
  currentShippingEstimate?: number | null;  // null = pending/unknown
  currentDiscount?: { code: string; amount: number; type: string; expired?: boolean } | null;
  currentTotal?: number;                    // Merchandise subtotal only if tax/shipping pending
  
  // Differences (merchandise only when tax/shipping pending)
  subtotalDifference?: number;
  totalDifference?: number;
  
  // Pending flags - indicates checkout will finalize these
  shippingPending?: boolean;
  taxPending?: boolean;
}

// ============================================================================
// Required Accessories Diff
// ============================================================================

export interface AccessoriesDiff {
  // Items that were saved but are no longer needed
  removed: Array<{
    sku: string;
    reason: string;
  }>;
  
  // Items that are now required but weren't saved
  added: Array<{
    sku: string;
    brand: string;
    model: string;
    unitPrice: number;
    reason: string;
    category: string;
  }>;
  
  // Items that are still required (may have price changes)
  unchanged: Array<{
    sku: string;
    savedPrice: number;
    currentPrice: number;
  }>;
}

// ============================================================================
// Warnings & Notices
// ============================================================================

export interface ValidationWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  itemSku?: string;
}

// ============================================================================
// Main Resume Validation Result
// ============================================================================

export interface ResumeValidationResult {
  // Quote identity
  quoteId: string;
  validatedAt: string;  // ISO timestamp
  
  // Vehicle validation
  vehicle: VehicleValidationResult;
  savedVehicle: SavedQuoteVehicle;
  
  // Item-by-item validation
  items: ValidatedItem[];
  
  // Accessory changes
  accessories?: AccessoriesDiff;
  
  // Pricing summary
  pricing: CurrentPricingSummary;
  
  // Overall status
  canContinue: boolean;
  continueBlockedReason?: string;
  
  // Warnings and notices
  warnings: ValidationWarning[];
  
  // What would be added to cart if user continues
  cartPreview?: {
    items: Array<{
      type: "wheel" | "tire" | "accessory";
      sku: string;
      quantity: number;
      unitPrice: number;
      brand: string;
      model: string;
    }>;
    subtotal: number;
    estimatedTax: number | null;
    estimatedShipping: number | null;
    total: number | null;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ResumeAPIResponse {
  ok: boolean;
  result?: ResumeValidationResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface ContinueAPIResponse {
  ok: boolean;
  cartReplaced?: boolean;
  redirectUrl?: string;
  error?: {
    code: string;
    message: string;
  };
}
