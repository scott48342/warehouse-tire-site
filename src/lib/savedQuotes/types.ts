/**
 * Saved Quotes Type Definitions
 * 
 * Types for the customer-saved shopping configurations feature.
 * 
 * @created 2026-08-24
 */

import type { CartWheelItem, CartTireItem, CartAccessoryItem } from "@/lib/cart/CartContext";

// ============================================================================
// Snapshot Types (stored in database)
// ============================================================================

/**
 * Vehicle information in saved quote
 */
export type SavedQuoteVehicle = {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;  // Canonical fitment ID
};

/**
 * Individual item in saved quote (subset of CartItem)
 * Server-validated and sanitized
 */
export type SavedQuoteItem = {
  type: "wheel" | "tire" | "accessory";
  sku: string;
  rearSku?: string;  // For staggered setups
  brand: string;
  model: string;
  quantity: number;
  unitPrice: number;  // Server-verified price at save time
  
  // Wheel-specific
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  
  // Tire-specific
  size?: string;
  rearSize?: string;
  loadIndex?: string;
  speedRating?: string;
  
  // Accessory-specific
  category?: string;
  required?: boolean;
  reason?: string;
  
  // Common
  imageUrl?: string;
  staggered?: boolean;
  source?: string;
};

/**
 * Pricing at save time (server-computed)
 */
export type SavedQuotePricing = {
  partsSubtotal: number;      // Taxable items
  servicesSubtotal: number;   // Non-taxable
  estimatedTax: number;
  taxRate: number;
  estimatedShipping: number | null;  // null if unknown
  discount?: {
    code: string;
    amount: number;
    type: string;
  };
  total: number;
};

/**
 * Immutable saved quote snapshot
 * This is what gets stored in snapshot_json
 */
export type SavedQuoteSnapshot = {
  vehicle: SavedQuoteVehicle;
  items: SavedQuoteItem[];
  pricing: SavedQuotePricing;
  savedFrom: "cart" | "package-builder" | "pdp";
  savedAt: string;  // ISO timestamp
  cartId?: string;  // For correlation/analytics
  itemSummary: string;  // e.g., "4x Fuel Rebel + 4x BFGoodrich KO2"
};

// ============================================================================
// API Types
// ============================================================================

/**
 * Client request to save a quote (untrusted, will be validated)
 */
export type SaveQuoteRequest = {
  vehicle: {
    year: string | number;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  items: Array<{
    type: "wheel" | "tire" | "accessory";
    sku: string;
    rearSku?: string;
    brand?: string;
    model?: string;
    quantity: number;
    unitPrice?: number;
    // Allow other cart fields
    [key: string]: unknown;
  }>;
  name?: string;  // Optional quote name
  source?: "cart" | "package-builder" | "pdp";
  cartId?: string;
  
  // Idempotency key for retry protection
  idempotencyKey?: string;
};

/**
 * Saved quote as returned by API
 */
export type SavedQuoteResponse = {
  id: string;
  name: string | null;
  vehicle: SavedQuoteVehicle;
  itemCount: number;
  itemSummary: string;
  total: number;
  savedAt: string;
  lastViewedAt: string | null;
  convertedOrderId: string | null;
  convertedAt: string | null;
  isArchived: boolean;
};

/**
 * Saved quote detail (includes full snapshot)
 */
export type SavedQuoteDetailResponse = SavedQuoteResponse & {
  snapshot: SavedQuoteSnapshot;
};

/**
 * List response
 */
export type SavedQuotesListResponse = {
  quotes: SavedQuoteResponse[];
  count: number;
  maxQuotes: number;
};

// ============================================================================
// Validation Constants
// ============================================================================

export const SAVED_QUOTE_LIMITS = {
  maxActiveQuotes: 20,
  maxItems: 50,
  maxQuantityPerItem: 20,
  maxSnapshotBytes: 100 * 1024,  // 100KB
  maxNameLength: 100,
  idempotencyWindowMs: 60 * 1000,  // 1 minute
} as const;
