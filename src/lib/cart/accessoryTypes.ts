/**
 * Accessory Cart Types
 * 
 * Extends cart with lug nuts, hub rings, and other accessories
 */

export type CartAccessoryItem = {
  type: "accessory";
  category: "lug_nut" | "hub_ring" | "lug_bolt" | "valve_stem" | "tpms";
  sku: string;
  name: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  required: boolean;
  reason: string;
  // Link to the wheel this accessory is for
  wheelSku?: string;
  // Spec details for display
  spec?: {
    threadSize?: string;
    seatType?: string;
    outerDiameter?: number;
    innerDiameter?: number;
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
