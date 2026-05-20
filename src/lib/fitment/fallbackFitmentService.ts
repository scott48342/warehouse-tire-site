/**
 * Fallback Fitment Intelligence Service
 * 
 * Provides inferred/common OEM fitment data when the primary WTD
 * fitment database doesn't have a vehicle.
 * 
 * IMPORTANT: This is NOT a replacement for verified fitment data.
 * All fallback results are clearly labeled with confidence levels.
 * 
 * @created 2026-05-20
 */

// ============================================================================
// TYPES
// ============================================================================

export type FallbackConfidence = 
  | "high"     // 90%+ confident - common vehicle with well-documented specs
  | "medium"   // 70-90% confident - good data but some trim variation
  | "low"      // 50-70% confident - educated guess based on platform/era
  | "unknown"; // < 50% confident - asking customer to verify

export type FallbackSource = 
  | "curated_oem"       // Hand-curated OEM reference data
  | "platform_inference" // Inferred from shared platform
  | "era_common"        // Common specs for vehicle era/class
  | "customer_verify";  // Need customer to verify

export interface FallbackFitmentResult {
  success: boolean;
  confidence: FallbackConfidence;
  source: FallbackSource;
  
  // Core fitment data
  boltPattern?: string;       // e.g., "5x115"
  boltPatternMetric?: string; // e.g., "5x114.3"
  centerBore?: number;        // e.g., 70.3
  
  // OEM tire sizes (most common)
  tireSizes?: {
    size: string;           // e.g., "235/55R17"
    isOem: boolean;         // true if known OEM
    trimLevel?: string;     // which trim this applies to
  }[];
  
  // OEM wheel sizes
  wheelDiameters?: number[];  // e.g., [17, 18]
  wheelWidths?: number[];     // e.g., [7, 7.5, 8]
  
  // Offset range (if known)
  offsetRange?: {
    min: number;
    max: number;
  };
  
  // Platform info
  platform?: string;          // e.g., "GM Epsilon II"
  sharedWith?: string[];      // e.g., ["Buick Lucerne", "Cadillac STS"]
  
  // Messaging for Jake
  confidenceMessage: string;
  warningMessage?: string;
  verifyPrompt?: string;      // What to ask customer to verify
  
  // Tracking
  vehicleKey: string;         // "2009|Cadillac|DTS" for logging
  lookupTimestamp: number;
}

export interface FallbackLookupRequest {
  year: number;
  make: string;
  model: string;
  trim?: string;
}

// ============================================================================
// CURATED OEM REFERENCE DATA
// This is hand-curated data for common vehicles missing from our DB
// ============================================================================

interface CuratedVehicleData {
  boltPattern: string;
  centerBore: number;
  tireSizes: { size: string; trims?: string[] }[];
  wheelDiameters: number[];
  wheelWidths: number[];
  offsetRange: { min: number; max: number };
  platform?: string;
  sharedWith?: string[];
  notes?: string;
}

// Key format: "make|model" (year ranges handled separately)
const CURATED_FITMENTS: Record<string, {
  yearRange: [number, number];
  data: CuratedVehicleData;
}[]> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CADILLAC
  // ═══════════════════════════════════════════════════════════════════════════
  "cadillac|dts": [
    {
      yearRange: [2006, 2011],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "235/55R17", trims: ["Base", "Luxury", "Performance"] },
          { size: "245/50R18", trims: ["Platinum", "Performance"] },
        ],
        wheelDiameters: [17, 18],
        wheelWidths: [7, 7.5, 8],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body (Sigma platform)",
        sharedWith: ["Buick Lucerne"],
        notes: "FWD luxury sedan, succeeded the DeVille",
      },
    },
  ],
  "cadillac|deville": [
    {
      yearRange: [2000, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["Base", "DHS"] },
          { size: "235/55R17", trims: ["DTS"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body",
        sharedWith: ["Buick Park Avenue", "Oldsmobile Aurora"],
      },
    },
  ],
  "cadillac|seville": [
    {
      yearRange: [1998, 2004],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["SLS"] },
          { size: "235/55R17", trims: ["STS"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 48 },
        platform: "GM G-body",
      },
    },
  ],
  "cadillac|eldorado": [
    {
      yearRange: [1992, 2002],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["Base", "ESC"] },
          { size: "235/60R16", trims: ["ETC"] },
        ],
        wheelDiameters: [16],
        wheelWidths: [7],
        offsetRange: { min: 38, max: 46 },
        platform: "GM E-body",
        sharedWith: ["Oldsmobile Toronado"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BUICK
  // ═══════════════════════════════════════════════════════════════════════════
  "buick|lucerne": [
    {
      yearRange: [2006, 2011],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["CX"] },
          { size: "235/55R17", trims: ["CXL", "CXS"] },
          { size: "245/50R18", trims: ["Super"] },
        ],
        wheelDiameters: [16, 17, 18],
        wheelWidths: [7, 7.5, 8],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body (Sigma platform)",
        sharedWith: ["Cadillac DTS"],
      },
    },
  ],
  "buick|lesabre": [
    {
      yearRange: [2000, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["Custom", "Limited"] },
        ],
        wheelDiameters: [16],
        wheelWidths: [6.5, 7],
        offsetRange: { min: 40, max: 48 },
        platform: "GM H-body",
        sharedWith: ["Pontiac Bonneville", "Oldsmobile 88"],
      },
    },
  ],
  "buick|park avenue": [
    {
      yearRange: [1997, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["Base"] },
          { size: "235/55R17", trims: ["Ultra"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body",
        sharedWith: ["Cadillac DeVille"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LINCOLN
  // ═══════════════════════════════════════════════════════════════════════════
  "lincoln|town car": [
    {
      yearRange: [2003, 2011],
      data: {
        boltPattern: "5x114.3",
        centerBore: 70.5,
        tireSizes: [
          { size: "225/60R17", trims: ["Executive", "Signature"] },
          { size: "235/55R17", trims: ["Signature L", "Designer"] },
        ],
        wheelDiameters: [17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "Ford Panther",
        sharedWith: ["Ford Crown Victoria", "Mercury Grand Marquis"],
      },
    },
    {
      yearRange: [1998, 2002],
      data: {
        boltPattern: "5x114.3",
        centerBore: 70.5,
        tireSizes: [
          { size: "225/60R16", trims: ["Executive", "Signature"] },
          { size: "225/60R17", trims: ["Cartier"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7],
        offsetRange: { min: 38, max: 48 },
        platform: "Ford Panther",
        sharedWith: ["Ford Crown Victoria", "Mercury Grand Marquis"],
      },
    },
  ],
  "lincoln|continental": [
    {
      yearRange: [2017, 2020],
      data: {
        boltPattern: "5x114.3",
        centerBore: 63.4,
        tireSizes: [
          { size: "245/45R19", trims: ["Premiere", "Select"] },
          { size: "245/40R20", trims: ["Reserve", "Black Label"] },
        ],
        wheelDiameters: [19, 20],
        wheelWidths: [8, 8.5],
        offsetRange: { min: 40, max: 50 },
        platform: "Ford CD4",
        sharedWith: ["Ford Fusion", "Lincoln MKZ"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MERCURY (discontinued brand)
  // ═══════════════════════════════════════════════════════════════════════════
  "mercury|grand marquis": [
    {
      yearRange: [2003, 2011],
      data: {
        boltPattern: "5x114.3",
        centerBore: 70.5,
        tireSizes: [
          { size: "225/60R16", trims: ["GS"] },
          { size: "225/60R17", trims: ["LS"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7],
        offsetRange: { min: 38, max: 48 },
        platform: "Ford Panther",
        sharedWith: ["Ford Crown Victoria", "Lincoln Town Car"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // OLDSMOBILE (discontinued brand)
  // ═══════════════════════════════════════════════════════════════════════════
  "oldsmobile|aurora": [
    {
      yearRange: [2001, 2003],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["3.5"] },
          { size: "235/55R17", trims: ["4.0"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body",
        sharedWith: ["Buick Park Avenue", "Cadillac DeVille"],
      },
    },
  ],
  "oldsmobile|alero": [
    {
      yearRange: [1999, 2004],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "215/60R15", trims: ["GX"] },
          { size: "225/50R16", trims: ["GL", "GLS"] },
        ],
        wheelDiameters: [15, 16],
        wheelWidths: [6, 6.5],
        offsetRange: { min: 35, max: 45 },
        platform: "GM N-body",
        sharedWith: ["Pontiac Grand Am", "Chevrolet Malibu"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PONTIAC (discontinued brand)
  // ═══════════════════════════════════════════════════════════════════════════
  "pontiac|g8": [
    {
      yearRange: [2008, 2009],
      data: {
        boltPattern: "5x120",
        centerBore: 67.1,
        tireSizes: [
          { size: "245/45R18", trims: ["Base"] },
          { size: "245/40R19", trims: ["GT", "GXP"] },
        ],
        wheelDiameters: [18, 19],
        wheelWidths: [8, 8.5],
        offsetRange: { min: 35, max: 45 },
        platform: "GM Zeta",
        sharedWith: ["Chevrolet SS", "Holden Commodore"],
      },
    },
  ],
  "pontiac|grand prix": [
    {
      yearRange: [2004, 2008],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["Base"] },
          { size: "225/55R17", trims: ["GT", "GTP"] },
          { size: "235/50R18", trims: ["GXP"] },
        ],
        wheelDiameters: [16, 17, 18],
        wheelWidths: [6.5, 7, 7.5],
        offsetRange: { min: 35, max: 48 },
        platform: "GM W-body",
        sharedWith: ["Buick Regal", "Chevrolet Impala"],
      },
    },
  ],
  "pontiac|bonneville": [
    {
      yearRange: [2000, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        tireSizes: [
          { size: "225/60R16", trims: ["SE"] },
          { size: "235/55R17", trims: ["SLE", "GXP"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM H-body",
        sharedWith: ["Buick LeSabre"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SATURN (discontinued brand)
  // ═══════════════════════════════════════════════════════════════════════════
  "saturn|aura": [
    {
      yearRange: [2007, 2009],
      data: {
        boltPattern: "5x110",
        centerBore: 65.1,
        tireSizes: [
          { size: "225/50R17", trims: ["XE", "XR"] },
          { size: "235/50R18", trims: ["XR"] },
        ],
        wheelDiameters: [17, 18],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 48 },
        platform: "GM Epsilon II",
        sharedWith: ["Chevrolet Malibu", "Pontiac G6"],
      },
    },
  ],
  "saturn|outlook": [
    {
      yearRange: [2007, 2010],
      data: {
        boltPattern: "6x132",
        centerBore: 74.5,
        tireSizes: [
          { size: "255/65R18", trims: ["XE", "XR"] },
          { size: "255/60R19", trims: ["XR"] },
        ],
        wheelDiameters: [18, 19],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 45, max: 55 },
        platform: "GM Lambda",
        sharedWith: ["GMC Acadia", "Buick Enclave", "Chevrolet Traverse"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HUMMER (discontinued brand)
  // ═══════════════════════════════════════════════════════════════════════════
  "hummer|h3": [
    {
      yearRange: [2006, 2010],
      data: {
        boltPattern: "6x139.7",
        centerBore: 78.1,
        tireSizes: [
          { size: "265/75R16", trims: ["Base"] },
          { size: "285/75R16", trims: ["H3T", "Adventure"] },
        ],
        wheelDiameters: [16],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 30, max: 40 },
        platform: "GM GMT355",
        sharedWith: ["Chevrolet Colorado", "GMC Canyon"],
      },
    },
  ],
  "hummer|h2": [
    {
      yearRange: [2003, 2009],
      data: {
        boltPattern: "8x165.1",
        centerBore: 121,
        tireSizes: [
          { size: "315/70R17", trims: ["Base", "Luxury"] },
        ],
        wheelDiameters: [17],
        wheelWidths: [8.5],
        offsetRange: { min: 20, max: 35 },
        platform: "GM GMT820",
        sharedWith: ["Chevrolet Silverado 2500", "GMC Sierra 2500"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SAAB (discontinued in US)
  // ═══════════════════════════════════════════════════════════════════════════
  "saab|9-3": [
    {
      yearRange: [2003, 2011],
      data: {
        boltPattern: "5x110",
        centerBore: 65.1,
        tireSizes: [
          { size: "215/55R16", trims: ["Linear"] },
          { size: "225/45R17", trims: ["Arc", "Vector"] },
          { size: "235/40R18", trims: ["Aero"] },
        ],
        wheelDiameters: [16, 17, 18],
        wheelWidths: [6.5, 7, 7.5],
        offsetRange: { min: 38, max: 45 },
        platform: "GM Epsilon",
        sharedWith: ["Chevrolet Malibu", "Opel Vectra"],
      },
    },
  ],
  "saab|9-5": [
    {
      yearRange: [1999, 2009],
      data: {
        boltPattern: "5x110",
        centerBore: 65.1,
        tireSizes: [
          { size: "215/55R16", trims: ["Linear"] },
          { size: "225/50R17", trims: ["Arc"] },
          { size: "235/45R17", trims: ["Aero"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [6.5, 7, 7.5],
        offsetRange: { min: 38, max: 45 },
        platform: "GM2900",
        sharedWith: ["Opel Vectra"],
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SUZUKI (US discontinued)
  // ═══════════════════════════════════════════════════════════════════════════
  "suzuki|grand vitara": [
    {
      yearRange: [2006, 2013],
      data: {
        boltPattern: "5x114.3",
        centerBore: 60.1,
        tireSizes: [
          { size: "225/70R16", trims: ["Base"] },
          { size: "225/65R17", trims: ["Premium", "Luxury"] },
          { size: "235/60R18", trims: ["Limited"] },
        ],
        wheelDiameters: [16, 17, 18],
        wheelWidths: [6.5, 7],
        offsetRange: { min: 40, max: 50 },
      },
    },
  ],
  "suzuki|kizashi": [
    {
      yearRange: [2010, 2013],
      data: {
        boltPattern: "5x114.3",
        centerBore: 60.1,
        tireSizes: [
          { size: "215/55R17", trims: ["S", "SE"] },
          { size: "225/50R18", trims: ["GTS", "SLS"] },
        ],
        wheelDiameters: [17, 18],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
      },
    },
  ],
};

// ============================================================================
// PLATFORM-BASED INFERENCE
// When we don't have exact vehicle data, we can infer from shared platforms
// ============================================================================

interface PlatformData {
  boltPattern: string;
  centerBore: number;
  commonTireSizes: string[];
  wheelDiameterRange: [number, number];
}

const GM_PLATFORMS: Record<string, PlatformData> = {
  "epsilon": {
    boltPattern: "5x110",
    centerBore: 65.1,
    commonTireSizes: ["225/50R17", "235/45R18"],
    wheelDiameterRange: [16, 19],
  },
  "epsilon-ii": {
    boltPattern: "5x120",
    centerBore: 67.1,
    commonTireSizes: ["225/50R17", "245/45R18", "245/40R19"],
    wheelDiameterRange: [17, 20],
  },
  "theta": {
    boltPattern: "5x115",
    centerBore: 70.3,
    commonTireSizes: ["235/65R17", "255/55R18", "255/50R19"],
    wheelDiameterRange: [17, 20],
  },
  "lambda": {
    boltPattern: "6x132",
    centerBore: 74.5,
    commonTireSizes: ["255/65R18", "255/60R19", "255/55R20"],
    wheelDiameterRange: [18, 22],
  },
  "zeta": {
    boltPattern: "5x120",
    centerBore: 67.1,
    commonTireSizes: ["245/45R18", "245/40R19", "275/35R20"],
    wheelDiameterRange: [18, 21],
  },
};

// ============================================================================
// ERA-BASED COMMON SPECS
// Fallback for when we have nothing else - based on vehicle class and era
// ============================================================================

type VehicleClass = 
  | "compact_sedan" 
  | "midsize_sedan" 
  | "fullsize_sedan" 
  | "luxury_sedan"
  | "compact_suv"
  | "midsize_suv"
  | "fullsize_suv"
  | "pickup_halfton"
  | "pickup_threeqtr"
  | "pickup_1ton";

function inferVehicleClass(make: string, model: string): VehicleClass | null {
  const key = `${make}|${model}`.toLowerCase();
  
  // Luxury sedans
  if (/cadillac|lincoln|lexus|infiniti|acura|genesis/.test(make.toLowerCase())) {
    if (/cts|ats|ct4|ct5|mkz|es|is|gs|tl|tsx|g35|g37|q50/.test(model.toLowerCase())) {
      return "luxury_sedan";
    }
    if (/escalade|navigator|qx|mdx|aviator/.test(model.toLowerCase())) {
      return "fullsize_suv";
    }
  }
  
  // Full-size sedans
  if (/dts|deville|town car|grand marquis|crown victoria|impala|charger|300/.test(model.toLowerCase())) {
    return "fullsize_sedan";
  }
  
  // Mid-size sedans
  if (/camry|accord|altima|fusion|malibu|sonata|optima/.test(model.toLowerCase())) {
    return "midsize_sedan";
  }
  
  // Compact sedans
  if (/civic|corolla|focus|cruze|elantra|sentra/.test(model.toLowerCase())) {
    return "compact_sedan";
  }
  
  return null;
}

const ERA_COMMON_SPECS: Record<VehicleClass, {
  boltPatterns: string[];
  commonTireSizes: string[];
  wheelDiameterRange: [number, number];
}> = {
  compact_sedan: {
    boltPatterns: ["5x100", "5x114.3"],
    commonTireSizes: ["195/65R15", "205/55R16", "215/50R17"],
    wheelDiameterRange: [15, 17],
  },
  midsize_sedan: {
    boltPatterns: ["5x114.3", "5x108"],
    commonTireSizes: ["215/55R17", "225/50R17", "235/45R18"],
    wheelDiameterRange: [16, 18],
  },
  fullsize_sedan: {
    boltPatterns: ["5x115", "5x114.3"],
    commonTireSizes: ["225/60R16", "235/55R17", "245/50R18"],
    wheelDiameterRange: [16, 18],
  },
  luxury_sedan: {
    boltPatterns: ["5x120", "5x112", "5x114.3"],
    commonTireSizes: ["225/55R17", "245/45R18", "255/40R19"],
    wheelDiameterRange: [17, 20],
  },
  compact_suv: {
    boltPatterns: ["5x114.3", "5x108"],
    commonTireSizes: ["225/65R17", "235/60R18", "235/55R19"],
    wheelDiameterRange: [17, 19],
  },
  midsize_suv: {
    boltPatterns: ["5x114.3", "5x120", "5x127"],
    commonTireSizes: ["245/60R18", "255/55R19", "265/50R20"],
    wheelDiameterRange: [18, 20],
  },
  fullsize_suv: {
    boltPatterns: ["6x139.7", "6x135"],
    commonTireSizes: ["265/70R17", "275/60R20", "285/55R22"],
    wheelDiameterRange: [17, 22],
  },
  pickup_halfton: {
    boltPatterns: ["6x139.7", "6x135"],
    commonTireSizes: ["265/70R17", "275/65R18", "275/60R20"],
    wheelDiameterRange: [17, 22],
  },
  pickup_threeqtr: {
    boltPatterns: ["8x165.1", "8x170", "8x180"],
    commonTireSizes: ["265/70R17", "275/70R18", "285/60R20"],
    wheelDiameterRange: [17, 20],
  },
  pickup_1ton: {
    boltPatterns: ["8x165.1", "8x170", "8x200", "8x210"],
    commonTireSizes: ["235/80R17", "265/70R17", "275/70R18"],
    wheelDiameterRange: [17, 20],
  },
};

// ============================================================================
// MAIN LOOKUP FUNCTION
// ============================================================================

export function lookupFallbackFitment(
  request: FallbackLookupRequest
): FallbackFitmentResult {
  const { year, make, model, trim } = request;
  const vehicleKey = `${year}|${make}|${model}`;
  const normalizedKey = `${make.toLowerCase()}|${model.toLowerCase()}`;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1: Check curated OEM data
  // ═══════════════════════════════════════════════════════════════════════════
  const curatedEntries = CURATED_FITMENTS[normalizedKey];
  
  if (curatedEntries) {
    for (const entry of curatedEntries) {
      const [minYear, maxYear] = entry.yearRange;
      if (year >= minYear && year <= maxYear) {
        const data = entry.data;
        
        // Build tire sizes with trim matching
        const tireSizes = data.tireSizes.map(ts => ({
          size: ts.size,
          isOem: true,
          trimLevel: ts.trims?.join(", "),
        }));
        
        return {
          success: true,
          confidence: "high",
          source: "curated_oem",
          boltPattern: data.boltPattern,
          centerBore: data.centerBore,
          tireSizes,
          wheelDiameters: data.wheelDiameters,
          wheelWidths: data.wheelWidths,
          offsetRange: data.offsetRange,
          platform: data.platform,
          sharedWith: data.sharedWith,
          confidenceMessage: `I don't have this exact vehicle in my verified database yet, but the ${year} ${make} ${model} commonly uses:`,
          vehicleKey,
          lookupTimestamp: Date.now(),
        };
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: Platform inference for GM vehicles
  // ═══════════════════════════════════════════════════════════════════════════
  // (Could expand this for Ford/Chrysler platforms too)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: Era-based inference
  // ═══════════════════════════════════════════════════════════════════════════
  const vehicleClass = inferVehicleClass(make, model);
  
  if (vehicleClass) {
    const eraSpecs = ERA_COMMON_SPECS[vehicleClass];
    
    return {
      success: true,
      confidence: "low",
      source: "era_common",
      tireSizes: eraSpecs.commonTireSizes.map(size => ({
        size,
        isOem: false,
      })),
      wheelDiameters: Array.from(
        { length: eraSpecs.wheelDiameterRange[1] - eraSpecs.wheelDiameterRange[0] + 1 },
        (_, i) => eraSpecs.wheelDiameterRange[0] + i
      ),
      confidenceMessage: `I don't have specific data for the ${year} ${make} ${model}, but based on similar vehicles from that era, common sizes are:`,
      warningMessage: "These are estimates. I'd recommend checking your door sticker or current tires for the exact size.",
      verifyPrompt: "Could you check the tire size on your door jamb sticker or the sidewall of your current tires? It'll look something like 235/55R17.",
      vehicleKey,
      lookupTimestamp: Date.now(),
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4: Can't determine - ask customer
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    success: false,
    confidence: "unknown",
    source: "customer_verify",
    confidenceMessage: `I don't have specific fitment data for the ${year} ${make} ${model} in my system yet.`,
    warningMessage: "But I can definitely still help you!",
    verifyPrompt: "If you can tell me the tire size from your door jamb sticker (something like 235/55R17), I can find great options for you. Or if you know your wheel bolt pattern, I can help with wheels too!",
    vehicleKey,
    lookupTimestamp: Date.now(),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a fallback result into Jake-friendly messaging
 */
export function formatFallbackForJake(result: FallbackFitmentResult): string {
  const parts: string[] = [];
  
  // Confidence message
  parts.push(result.confidenceMessage);
  
  // Specs if available
  if (result.boltPattern) {
    parts.push(`• Bolt pattern: ${result.boltPattern}`);
  }
  
  if (result.tireSizes && result.tireSizes.length > 0) {
    const sizeList = result.tireSizes
      .slice(0, 3)
      .map(ts => ts.size)
      .join(", ");
    parts.push(`• Common tire sizes: ${sizeList}`);
  }
  
  if (result.wheelDiameters && result.wheelDiameters.length > 0) {
    const diameters = result.wheelDiameters.slice(0, 3).join('", ');
    parts.push(`• OEM wheel sizes: ${diameters}"`);
  }
  
  // Warning if present
  if (result.warningMessage) {
    parts.push("");
    parts.push(result.warningMessage);
  }
  
  // Verify prompt if present
  if (result.verifyPrompt && result.confidence !== "high") {
    parts.push("");
    parts.push(result.verifyPrompt);
  }
  
  // Platform info for high confidence
  if (result.confidence === "high" && result.sharedWith && result.sharedWith.length > 0) {
    parts.push("");
    parts.push(`(This vehicle shares a platform with ${result.sharedWith.join(", ")})`);
  }
  
  return parts.join("\n");
}

/**
 * Get a simple tire size to use for searching
 */
export function getPrimaryTireSize(result: FallbackFitmentResult): string | null {
  if (!result.tireSizes || result.tireSizes.length === 0) {
    return null;
  }
  return result.tireSizes[0].size;
}

/**
 * Check if fallback data is sufficient for product search
 */
export function canSearchWithFallback(result: FallbackFitmentResult): {
  canSearchTires: boolean;
  canSearchWheels: boolean;
  reason?: string;
} {
  const canSearchTires = !!(result.tireSizes && result.tireSizes.length > 0);
  const canSearchWheels = !!(result.boltPattern && result.wheelDiameters?.length);
  
  return {
    canSearchTires,
    canSearchWheels,
    reason: !canSearchTires && !canSearchWheels 
      ? "Need tire size or bolt pattern from customer" 
      : undefined,
  };
}
