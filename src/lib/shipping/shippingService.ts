/**
 * Shipping Estimate Service
 * 
 * Fast, local ZIP-based shipping calculation:
 * - Zone-based pricing using ZIP prefixes
 * - Product type multipliers (wheels heavier than tires)
 * - Quantity tiers
 * - Free shipping threshold: $1500
 * 
 * No external API calls - instant response.
 * 
 * @created 2026-04-03
 * @updated 2026-04-05 - Threshold model: $1500 for free shipping
 */

// ============================================================================
// Configuration
// ============================================================================

/** Free shipping threshold - orders over this amount ship free */
export const FREE_SHIPPING_THRESHOLD = 1500;

/** Free shipping messaging */
export const FREE_SHIPPING_MESSAGE = "Free shipping on orders over $1,500";
export const PACKAGE_SHIPPING_MESSAGE = "Most packages qualify for free shipping";

/** Base shipping rates by zone (for a standard 4-wheel set) */
const ZONE_BASE_RATES: Record<number, number> = {
  1: 89,   // Local (same region as warehouse)
  2: 119,  // Regional (neighboring states)
  3: 149,  // National (mid-distance)
  4: 179,  // Remote (far states)
  5: 249,  // Extended (Alaska, Hawaii, territories)
};

/** Product type weight multipliers */
const PRODUCT_MULTIPLIERS = {
  wheel: 1.0,      // Wheels are the baseline
  tire: 0.7,       // Tires are lighter
  accessory: 0.05, // Accessories negligible
};

/** Quantity adjustments (per 4 items after first set) */
const QUANTITY_TIER_RATE = 0.25; // 25% more per additional set of 4

/**
 * ZIP prefix to zone mapping
 * Warehouse: Pontiac, MI (483xx)
 * Zone 1: Michigan & neighboring states
 * Zone 2: Midwest regional
 * Zone 3: National (East Coast, South)
 * Zone 4: West Coast & Mountain
 * Zone 5: Extended (AK, HI, territories)
 */
const ZIP_ZONES: Record<string, number> = {
  // Zone 1 - Michigan (warehouse region)
  "480": 1, "481": 1, "482": 1, "483": 1, "484": 1, "485": 1, "486": 1, "487": 1, "488": 1, "489": 1,
  "490": 1, "491": 1, "492": 1, "493": 1, "494": 1, "495": 1, "496": 1, "497": 1, "498": 1, "499": 1,
  // Ohio (neighboring)
  "430": 1, "431": 1, "432": 1, "433": 1, "434": 1, "435": 1, "436": 1, "437": 1, "438": 1, "439": 1,
  "440": 1, "441": 1, "442": 1, "443": 1, "444": 1, "445": 1, "446": 1, "447": 1, "448": 1, "449": 1,
  "450": 1, "451": 1, "452": 1, "453": 1, "454": 1, "455": 1, "456": 1, "457": 1, "458": 1,
  // Indiana (neighboring)
  "460": 1, "461": 1, "462": 1, "463": 1, "464": 1, "465": 1, "466": 1, "467": 1, "468": 1, "469": 1,
  "470": 1, "471": 1, "472": 1, "473": 1, "474": 1, "475": 1, "476": 1, "477": 1, "478": 1, "479": 1,
  
  // Zone 2 - Midwest Regional (IL, WI, MN, IA, KY, WV, PA-west)
  "600": 2, "601": 2, "602": 2, "603": 2, "604": 2, "605": 2, "606": 2, "607": 2, "608": 2, "609": 2,
  "610": 2, "611": 2, "612": 2, "613": 2, "614": 2, "615": 2, "616": 2, "617": 2, "618": 2, "619": 2,
  "530": 2, "531": 2, "532": 2, "534": 2, "535": 2, "537": 2, "538": 2, "539": 2, // Wisconsin
  "540": 2, "541": 2, "542": 2, "543": 2, "544": 2, "545": 2, "546": 2, "547": 2, "548": 2, "549": 2,
  "550": 2, "551": 2, "553": 2, "554": 2, "555": 2, "556": 2, "557": 2, "558": 2, "559": 2, // Minnesota
  "500": 2, "501": 2, "502": 2, "503": 2, "504": 2, "505": 2, "506": 2, "507": 2, "508": 2, "509": 2, // Iowa
  "510": 2, "511": 2, "512": 2, "513": 2, "514": 2, "515": 2, "516": 2, "520": 2, "521": 2, "522": 2,
  "400": 2, "401": 2, "402": 2, "403": 2, "404": 2, "405": 2, "406": 2, "407": 2, "408": 2, "409": 2, // Kentucky
  "410": 2, "411": 2, "412": 2, "413": 2, "414": 2, "415": 2, "416": 2, "417": 2, "418": 2,
  "150": 2, "151": 2, "152": 2, "153": 2, "154": 2, "155": 2, "156": 2, "157": 2, "158": 2, "159": 2, // PA West
  "160": 2, "161": 2, "162": 2, "163": 2, "164": 2, "165": 2, "166": 2,
  
  // Zone 5 - Extended (Alaska, Hawaii, PR)
  "995": 5, "996": 5, "997": 5, "998": 5, "999": 5, // Alaska
  "967": 5, "968": 5, // Hawaii
  "006": 5, "007": 5, "008": 5, "009": 5, // Puerto Rico
};

// ============================================================================
// Types
// ============================================================================

export interface ShippingItem {
  type: "wheel" | "tire" | "accessory";
  quantity: number;
  unitPrice?: number;
}

export interface ShippingEstimate {
  /** Shipping cost in dollars (0 if free) */
  amount: number;
  /** Is shipping free? */
  isFree: boolean;
  /** Zone used for calculation */
  zone: number;
  /** Zone name for display */
  zoneName: string;
  /** Amount needed for free shipping (0 if already free) */
  amountToFreeShipping: number;
  /** Formatted display string */
  displayAmount: string;
  /** Estimated delivery days */
  estimatedDays: { min: number; max: number };
  /** Is this an estimate or final? */
  isEstimate: boolean;
}

export interface ShippingInput {
  zipCode: string;
  items: ShippingItem[];
  subtotal: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get zone from ZIP code
 */
export function getZoneFromZip(zipCode: string): number {
  const prefix = zipCode.substring(0, 3);
  
  // Check explicit mapping first
  if (ZIP_ZONES[prefix]) {
    return ZIP_ZONES[prefix];
  }
  
  // Default zone based on first digit (rough geographic grouping from MI)
  const firstDigit = parseInt(prefix[0], 10);
  
  // Northeast (0-1) = Zone 3
  if (firstDigit <= 1) return 3;
  
  // Mid-Atlantic (2) = Zone 3
  if (firstDigit === 2) return 3;
  
  // Southeast (3) = Zone 3
  if (firstDigit === 3) return 3;
  
  // Midwest - closer (4) = Zone 2
  if (firstDigit === 4) return 2;
  
  // Central (5) = Zone 2
  if (firstDigit === 5) return 2;
  
  // Midwest/Plains (6) = Zone 2
  if (firstDigit === 6) return 2;
  
  // Southwest/Mountain (7-8) = Zone 4
  if (firstDigit <= 8) return 4;
  
  // West Coast (9) = Zone 4
  return 4;
}

/**
 * Get zone name for display
 */
function getZoneName(zone: number): string {
  const names: Record<number, string> = {
    1: "Local",
    2: "Regional", 
    3: "Standard",
    4: "Extended",
    5: "Remote",
  };
  return names[zone] || "Standard";
}

/**
 * Get estimated delivery days by zone
 */
function getEstimatedDays(zone: number): { min: number; max: number } {
  const estimates: Record<number, { min: number; max: number }> = {
    1: { min: 2, max: 4 },
    2: { min: 3, max: 5 },
    3: { min: 4, max: 7 },
    4: { min: 5, max: 9 },
    5: { min: 7, max: 14 },
  };
  return estimates[zone] || { min: 5, max: 10 };
}

/**
 * Validate ZIP code format
 */
export function isValidZipCode(zipCode: string): boolean {
  // US ZIP: 5 digits or 5+4 format
  return /^\d{5}(-\d{4})?$/.test(zipCode);
}

/**
 * Format ZIP code (normalize to 5 digits)
 */
export function normalizeZipCode(zipCode: string): string {
  return zipCode.replace(/[^\d]/g, "").substring(0, 5);
}

// ============================================================================
// Main Calculation
// ============================================================================

/**
 * Calculate shipping estimate
 */
export function calculateShipping(input: ShippingInput): ShippingEstimate {
  const { zipCode, items, subtotal } = input;
  
  // Free shipping threshold check
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    const zone = zipCode ? getZoneFromZip(normalizeZipCode(zipCode)) : 3;
    return {
      amount: 0,
      isFree: true,
      zone,
      zoneName: getZoneName(zone),
      amountToFreeShipping: 0,
      displayAmount: "FREE",
      estimatedDays: getEstimatedDays(zone),
      isEstimate: !zipCode,
    };
  }
  
  // Need ZIP for calculation
  if (!zipCode || !isValidZipCode(zipCode)) {
    return {
      amount: 0,
      isFree: false,
      zone: 0,
      zoneName: "Unknown",
      amountToFreeShipping: FREE_SHIPPING_THRESHOLD - subtotal,
      displayAmount: "Enter ZIP",
      estimatedDays: { min: 3, max: 10 },
      isEstimate: true,
    };
  }
  
  const normalizedZip = normalizeZipCode(zipCode);
  const zone = getZoneFromZip(normalizedZip);
  const baseRate = ZONE_BASE_RATES[zone] || ZONE_BASE_RATES[3];
  
  // Calculate weighted shipping based on items
  let totalWeight = 0;
  
  for (const item of items) {
    const multiplier = PRODUCT_MULTIPLIERS[item.type] || 1;
    totalWeight += item.quantity * multiplier;
  }
  
  // Base calculation: assume 4 items = 1 "set"
  const sets = Math.max(1, totalWeight / 4);
  
  // Apply quantity tier adjustments
  let shippingAmount = baseRate;
  if (sets > 1) {
    // Each additional set adds 25% of base rate
    shippingAmount += baseRate * QUANTITY_TIER_RATE * (sets - 1);
  }
  
  // Round to nearest dollar
  shippingAmount = Math.round(shippingAmount);
  
  return {
    amount: shippingAmount,
    isFree: false,
    zone,
    zoneName: getZoneName(zone),
    amountToFreeShipping: FREE_SHIPPING_THRESHOLD - subtotal,
    displayAmount: `$${shippingAmount}`,
    estimatedDays: getEstimatedDays(zone),
    isEstimate: true, // Always estimate until checkout confirms
  };
}

/**
 * Quick estimate without items (for display purposes)
 */
export function getQuickEstimate(subtotal: number, zipCode?: string): ShippingEstimate {
  // Assume typical wheel+tire package (8 items)
  const items: ShippingItem[] = [
    { type: "wheel", quantity: 4 },
    { type: "tire", quantity: 4 },
  ];
  
  return calculateShipping({
    zipCode: zipCode || "",
    items,
    subtotal,
  });
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// Exports
// ============================================================================

export const shippingService = {
  calculateShipping,
  getQuickEstimate,
  getZoneFromZip,
  isValidZipCode,
  normalizeZipCode,
  formatCurrency,
  FREE_SHIPPING_THRESHOLD,
};

export default shippingService;
