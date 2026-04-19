/**
 * Accessory Cart Types
 * 
 * Extends cart with lug nuts, hub rings, suspension, and other accessories
 */

export type AccessoryCategory = 
  | "lug_nut" 
  | "hub_ring" 
  | "lug_bolt" 
  | "valve_stem" 
  | "tpms"
  | "center_cap"
  | "lighting"
  | "spacer"
  | "suspension"  // lift kits, leveling kits, shocks
  | "other";

export type CartAccessoryItem = {
  type: "accessory";
  category: AccessoryCategory;
  sku: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  required: boolean;
  reason: string;
  /** Arbitrary metadata for order payloads (e.g., nipCost, msrp, source title). */
  meta?: Record<string, any>;
  // Link to the wheel this accessory is for
  wheelSku?: string;
  // Spec details for display
  spec?: {
    threadSize?: string;
    seatType?: string;
    outerDiameter?: number;
    innerDiameter?: number;
    // Suspension-specific
    liftHeight?: number;
    liftLevel?: string;
    productType?: string;
  };
  vehicle?: {
    year: string;
    make: string;
    model: string;
  };
};

export type AccessoryRecommendationState = {
  wheelSku: string;
  lugNuts: {
    status: "required" | "recommended" | "optional" | "skipped";
    reason: string;
    items: CartAccessoryItem[];
  };
  hubRings: {
    status: "required" | "not_needed" | "optional" | "skipped";
    reason: string;
    items: CartAccessoryItem[];
  };
  timestamp: string;
};
