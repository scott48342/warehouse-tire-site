/**
 * Accessory Fitment Service
 * 
 * Auto-recommends lug nuts and hub rings based on:
 * - dbProfile (vehicle specs: threadSize, seatType, centerBoreMm)
 * - Selected wheel (centerBore, seatType if specified)
 * 
 * Rules:
 * - Lug nuts: Match thread size + seat type
 * - Hub rings: Required when wheel bore > vehicle hub bore
 * - Never guess - skip if data missing
 */

// ============================================================================
// Types
// ============================================================================

export interface VehicleFitmentData {
  threadSize: string | null;      // e.g., "M14x1.5", "1/2\" - 20 UNF"
  seatType: string | null;        // e.g., "conical", "ball", "flat"
  centerBoreMm: number | null;    // e.g., 71.6
  boltPattern: string | null;     // e.g., "5x127" - used for lug count
}

export interface WheelData {
  sku: string;
  centerBore?: number;            // Wheel's center bore in mm
  seatType?: string;              // Some wheels specify required seat type
  boltPattern?: string;
}

export interface LugNutSpec {
  threadDiameter: number;         // mm (e.g., 14) or inches (e.g., 0.5)
  threadPitch: number;            // mm (e.g., 1.5) or TPI (e.g., 20)
  isMetric: boolean;
  seatType: string;               // "conical", "ball", "flat", "mag"
  quantity: number;               // Total needed (lugs per wheel × 4)
  raw: string;                    // Original string from API
}

export interface HubRingSpec {
  outerDiameter: number;          // Wheel bore (larger)
  innerDiameter: number;          // Vehicle hub (smaller)
  quantity: number;               // Always 4
}

export interface AccessoryMatch {
  sku: string;
  name: string;
  type: "lug_nut" | "hub_ring" | "lug_bolt";
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  imageUrl?: string;
}

export interface AccessoryRecommendation {
  category: "lug_nuts" | "hub_rings";
  status: "required" | "recommended" | "optional" | "skipped";
  reason: string;
  spec?: LugNutSpec | HubRingSpec;
  matches: AccessoryMatch[];
  skippedReason?: string;
}

export interface AccessoryFitmentResult {
  vehicle: {
    threadSize: string | null;
    seatType: string | null;
    centerBoreMm: number | null;
    lugCount: number;
  };
  wheel: {
    sku: string;
    centerBore: number | null;
    seatType: string | null;
  };
  lugNuts: AccessoryRecommendation;
  hubRings: AccessoryRecommendation;
  warnings: string[];
  timestamp: string;
}

// ============================================================================
// Thread Size Parser
// ============================================================================

/**
 * Parse thread size string into components
 * Handles both metric (M14x1.5) and imperial (1/2"-20 UNF) formats
 */
export function parseThreadSize(raw: string | null): LugNutSpec | null {
  if (!raw) return null;
  
  const s = raw.trim().toUpperCase();
  
  // Metric: M14x1.5, M12 x 1.25, M14X1.5
  const metricMatch = s.match(/M(\d+)\s*[Xx×]\s*([\d.]+)/);
  if (metricMatch) {
    return {
      threadDiameter: parseFloat(metricMatch[1]),
      threadPitch: parseFloat(metricMatch[2]),
      isMetric: true,
      seatType: "conical", // Will be overridden
      quantity: 20,        // Will be overridden
      raw,
    };
  }
  
  // Imperial: 1/2"-20 UNF, 1/2" - 20, 7/16-20
  const imperialMatch = s.match(/(\d+)\/(\d+)["\s-]*(\d+)/);
  if (imperialMatch) {
    const diameter = parseFloat(imperialMatch[1]) / parseFloat(imperialMatch[2]);
    const tpi = parseFloat(imperialMatch[3]);
    return {
      threadDiameter: diameter,
      threadPitch: tpi,
      isMetric: false,
      seatType: "conical",
      quantity: 20,
      raw,
    };
  }
  
  // Try simple numeric: 14x1.5 (without M prefix)
  const simpleMatch = s.match(/(\d+)\s*[Xx×]\s*([\d.]+)/);
  if (simpleMatch) {
    const dia = parseFloat(simpleMatch[1]);
    // If diameter > 20, probably metric (M14, M12)
    // If diameter < 1, probably imperial fraction
    const isMetric = dia >= 8;
    return {
      threadDiameter: dia,
      threadPitch: parseFloat(simpleMatch[2]),
      isMetric,
      seatType: "conical",
      quantity: 20,
      raw,
    };
  }
  
  console.log(`[accessories] Could not parse thread size: "${raw}"`);
  return null;
}

/**
 * Format thread size for display
 */
export function formatThreadSize(spec: LugNutSpec): string {
  if (spec.isMetric) {
    return `M${spec.threadDiameter}x${spec.threadPitch}`;
  }
  // Convert decimal back to fraction for imperial
  const fractions: Record<number, string> = {
    0.5: "1/2",
    0.4375: "7/16",
    0.375: "3/8",
  };
  const frac = fractions[spec.threadDiameter] || spec.threadDiameter.toFixed(3);
  return `${frac}"-${spec.threadPitch}`;
}

// ============================================================================
// Seat Type Normalization
// ============================================================================

const SEAT_TYPE_ALIASES: Record<string, string> = {
  "conical": "conical",
  "cone": "conical",
  "acorn": "conical",
  "tapered": "conical",
  "60°": "conical",
  "60 degree": "conical",
  
  "ball": "ball",
  "radius": "ball",
  "spherical": "ball",
  "round": "ball",
  
  "flat": "flat",
  "washer": "flat",
  "mag": "mag",
  "shank": "mag",
  "extended": "mag",
};

export function normalizeSeatType(raw: string | null): string {
  if (!raw) return "conical"; // Default to most common
  
  const lower = raw.toLowerCase().trim();
  
  for (const [alias, canonical] of Object.entries(SEAT_TYPE_ALIASES)) {
    if (lower.includes(alias)) {
      return canonical;
    }
  }
  
  return "conical"; // Default
}

// ============================================================================
// Lug Count from Bolt Pattern
// ============================================================================

export function getLugCount(boltPattern: string | null): number {
  if (!boltPattern) return 5; // Default assumption
  
  // Parse "5x127", "6x139.7", "4x100"
  const match = boltPattern.match(/^(\d+)\s*[xX×]/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return 5;
}

// ============================================================================
// Hub Ring Logic
// ============================================================================

const HUB_RING_TOLERANCE_MM = 0.5; // Within 0.5mm = no ring needed

export function calculateHubRingSpec(
  vehicleHubMm: number | null,
  wheelBoreMm: number | null
): HubRingSpec | null {
  if (vehicleHubMm === null || wheelBoreMm === null) {
    return null;
  }
  
  // No ring needed if wheel bore matches vehicle hub
  if (Math.abs(wheelBoreMm - vehicleHubMm) < HUB_RING_TOLERANCE_MM) {
    return null;
  }
  
  // Wheel bore must be LARGER than vehicle hub
  if (wheelBoreMm < vehicleHubMm) {
    // This is a fitment error - wheel won't fit
    console.warn(`[accessories] Wheel bore (${wheelBoreMm}mm) smaller than vehicle hub (${vehicleHubMm}mm) - fitment error`);
    return null;
  }
  
  return {
    outerDiameter: wheelBoreMm,
    innerDiameter: vehicleHubMm,
    quantity: 4,
  };
}

export function formatHubRingSpec(spec: HubRingSpec): string {
  return `${spec.outerDiameter.toFixed(1)}mm → ${spec.innerDiameter.toFixed(1)}mm`;
}

// ============================================================================
// Main Service
// ============================================================================

export interface GetAccessoryFitmentOptions {
  /** If true, include placeholder matches even without real inventory lookup */
  includePlaceholders?: boolean;
}

/**
 * Get accessory recommendations for a vehicle + wheel combination
 */
export function getAccessoryFitment(
  vehicle: VehicleFitmentData,
  wheel: WheelData,
  options: GetAccessoryFitmentOptions = {}
): AccessoryFitmentResult {
  const { includePlaceholders = true } = options;
  const warnings: string[] = [];
  const timestamp = new Date().toISOString();
  
  const lugCount = getLugCount(vehicle.boltPattern);
  const totalLugs = lugCount * 4;
  
  console.log(`[accessories] Calculating fitment:`, {
    vehicle: {
      threadSize: vehicle.threadSize,
      seatType: vehicle.seatType,
      centerBoreMm: vehicle.centerBoreMm,
      boltPattern: vehicle.boltPattern,
    },
    wheel: {
      sku: wheel.sku,
      centerBore: wheel.centerBore,
      seatType: wheel.seatType,
    },
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // Lug Nuts
  // ─────────────────────────────────────────────────────────────────────────
  
  let lugNuts: AccessoryRecommendation;
  
  const threadSpec = parseThreadSize(vehicle.threadSize);
  
  if (!threadSpec) {
    lugNuts = {
      category: "lug_nuts",
      status: "skipped",
      reason: "Thread size not available for this vehicle",
      matches: [],
      skippedReason: vehicle.threadSize 
        ? `Could not parse thread size: "${vehicle.threadSize}"`
        : "No thread size data in vehicle profile",
    };
    
    console.log(`[accessories] Lug nuts SKIPPED: ${lugNuts.skippedReason}`);
  } else {
    // Determine seat type (wheel spec overrides vehicle default)
    const seatType = normalizeSeatType(wheel.seatType || vehicle.seatType);
    
    threadSpec.seatType = seatType;
    threadSpec.quantity = totalLugs;
    
    const matches: AccessoryMatch[] = [];
    
    if (includePlaceholders) {
      // Placeholder - in production, query actual inventory
      const threadLabel = formatThreadSize(threadSpec);
      matches.push({
        sku: `LUG-${threadSpec.isMetric ? 'M' : 'I'}${threadSpec.threadDiameter}-${seatType.toUpperCase()}`,
        name: `${seatType.charAt(0).toUpperCase() + seatType.slice(1)} Lug Nut ${threadLabel}`,
        type: "lug_nut",
        unitPrice: 2.50,
        quantity: totalLugs,
        totalPrice: 2.50 * totalLugs,
      });
    }
    
    lugNuts = {
      category: "lug_nuts",
      status: "required",
      reason: `${totalLugs} ${seatType} lug nuts required (${formatThreadSize(threadSpec)})`,
      spec: threadSpec,
      matches,
    };
    
    console.log(`[accessories] Lug nuts: ${lugNuts.reason}`);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Hub Rings
  // ─────────────────────────────────────────────────────────────────────────
  
  let hubRings: AccessoryRecommendation;
  
  const vehicleHub = vehicle.centerBoreMm;
  const wheelBore = wheel.centerBore ?? null;
  
  if (vehicleHub === null) {
    hubRings = {
      category: "hub_rings",
      status: "skipped",
      reason: "Vehicle center bore not available",
      matches: [],
      skippedReason: "No center bore data in vehicle profile",
    };
    
    console.log(`[accessories] Hub rings SKIPPED: ${hubRings.skippedReason}`);
  } else if (wheelBore === null) {
    hubRings = {
      category: "hub_rings",
      status: "skipped",
      reason: "Wheel center bore not specified",
      matches: [],
      skippedReason: "Wheel does not specify center bore",
    };
    
    warnings.push("Hub ring requirement cannot be determined without wheel center bore");
    console.log(`[accessories] Hub rings SKIPPED: ${hubRings.skippedReason}`);
  } else {
    const ringSpec = calculateHubRingSpec(vehicleHub, wheelBore);
    
    if (!ringSpec) {
      // No ring needed - wheel matches vehicle
      hubRings = {
        category: "hub_rings",
        status: "optional",
        reason: `Wheel center bore (${wheelBore}mm) matches vehicle hub (${vehicleHub}mm)`,
        matches: [],
      };
      
      console.log(`[accessories] Hub rings NOT NEEDED: bore matches`);
    } else {
      const matches: AccessoryMatch[] = [];
      
      if (includePlaceholders) {
        matches.push({
          sku: `HR-${ringSpec.outerDiameter.toFixed(0)}-${ringSpec.innerDiameter.toFixed(0)}`,
          name: `Hub Centric Ring ${formatHubRingSpec(ringSpec)}`,
          type: "hub_ring",
          unitPrice: 8.00,
          quantity: 4,
          totalPrice: 32.00,
        });
      }
      
      hubRings = {
        category: "hub_rings",
        status: "required",
        reason: `Hub rings required: wheel bore ${wheelBore}mm > vehicle hub ${vehicleHub}mm`,
        spec: ringSpec,
        matches,
      };
      
      console.log(`[accessories] Hub rings REQUIRED: ${formatHubRingSpec(ringSpec)}`);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Result
  // ─────────────────────────────────────────────────────────────────────────
  
  const result: AccessoryFitmentResult = {
    vehicle: {
      threadSize: vehicle.threadSize,
      seatType: vehicle.seatType,
      centerBoreMm: vehicle.centerBoreMm,
      lugCount,
    },
    wheel: {
      sku: wheel.sku,
      centerBore: wheelBore,
      seatType: wheel.seatType || null,
    },
    lugNuts,
    hubRings,
    warnings,
    timestamp,
  };
  
  return result;
}

// ============================================================================
// Helper: Extract vehicle data from dbProfile
// ============================================================================

export function extractVehicleFitmentData(dbProfile: {
  threadSize?: string | null;
  seatType?: string | null;
  centerBoreMm?: number | null;
  boltPattern?: string | null;
} | null): VehicleFitmentData {
  return {
    threadSize: dbProfile?.threadSize ?? null,
    seatType: dbProfile?.seatType ?? null,
    centerBoreMm: dbProfile?.centerBoreMm ?? null,
    boltPattern: dbProfile?.boltPattern ?? null,
  };
}

// ============================================================================
// Helper: Format for UI display
// ============================================================================

export function formatAccessoryForUI(rec: AccessoryRecommendation): {
  badge: string;
  badgeColor: "red" | "yellow" | "green" | "gray";
  headline: string;
  explanation: string;
} {
  switch (rec.status) {
    case "required":
      return {
        badge: "Required",
        badgeColor: "red",
        headline: rec.category === "lug_nuts" ? "Lug Nuts Required" : "Hub Rings Required",
        explanation: rec.reason,
      };
    
    case "recommended":
      return {
        badge: "Recommended",
        badgeColor: "yellow",
        headline: rec.category === "lug_nuts" ? "Lug Nuts Recommended" : "Hub Rings Recommended",
        explanation: rec.reason,
      };
    
    case "optional":
      return {
        badge: "Not Needed",
        badgeColor: "green",
        headline: rec.category === "lug_nuts" ? "Lug Nuts" : "Hub Rings",
        explanation: rec.reason,
      };
    
    case "skipped":
      return {
        badge: "Info Needed",
        badgeColor: "gray",
        headline: rec.category === "lug_nuts" ? "Lug Nut Info" : "Hub Ring Info",
        explanation: rec.skippedReason || rec.reason,
      };
  }
}
