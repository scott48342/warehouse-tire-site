/**
 * Fallback Fitment Intelligence Service
 * 
 * Provides inferred/common OEM fitment data when the primary WTD
 * fitment database doesn't have a vehicle.
 * 
 * v2.0 - Extended with FULL aftermarket search profiles for wheel/tire searches
 * v2.1 - Added external Wheel-Size API lookup as last resort
 * 
 * LOOKUP PRIORITY:
 * 1. WTD verified fitment DB (handled upstream)
 * 2. Curated fallback profiles (this service - sync)
 * 3. External Wheel-Size API lookup (this service - async)
 * 4. Ask customer to verify
 * 
 * IMPORTANT: This is NOT a replacement for verified fitment data.
 * All fallback results are clearly labeled with confidence levels.
 * 
 * @created 2026-05-20
 * @updated 2026-05-20 - Added aftermarket search profiles
 * @updated 2026-05-20 - Added external Wheel-Size API lookup
 */

import { lookupExternalFitment, type ExternalLookupResult } from "./externalFitmentLookup";
import { researchTrustedFitment, type TrustedResearchResult } from "./trustedFitmentResearch";

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

export type FitmentLabel = 
  | "common_oem"              // Known OEM spec
  | "fallback_upgrade"        // Fallback upgrade guidance
  | "verify_clearance";       // Final clearance should be verified

// Aftermarket wheel search hint
export interface AftermarketWheelHint {
  diameter: number;
  widths: number[];              // Safe widths for this diameter
  offsetRange: { min: number; max: number };
  label: FitmentLabel;
  notes?: string;
}

// Plus-size tire option
export interface PlusSizeTireOption {
  size: string;
  wheelDiameter: number;
  label: FitmentLabel;
  notes?: string;
}

// Surrogate vehicle for fitment API search
export interface SurrogateVehicle {
  year: number;
  make: string;
  model: string;
  trim?: string;
  reason: string;  // Why this vehicle is used as surrogate
}

export interface FallbackFitmentResult {
  success: boolean;
  confidence: FallbackConfidence;
  source: FallbackSource;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CORE FITMENT DATA (OEM)
  // ═══════════════════════════════════════════════════════════════════════════
  boltPattern?: string;       // e.g., "5x115"
  boltPatternMetric?: string; // e.g., "5x114.3" (same or converted)
  centerBore?: number;        // e.g., 70.3
  threadSize?: string;        // e.g., "12x1.5" (lug thread)
  
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
  platform?: string;          // e.g., "GM Sigma platform"
  sharedWith?: string[];      // e.g., ["Buick Lucerne", "Cadillac STS"]
  
  // ═══════════════════════════════════════════════════════════════════════════
  // AFTERMARKET SEARCH PROFILE (NEW in v2.0)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Safe aftermarket upgrade diameters
  safeAftermarketDiameters?: number[];  // e.g., [19, 20, 22]
  
  // Detailed wheel search hints by diameter
  wheelSearchHints?: AftermarketWheelHint[];
  
  // Plus-size tire options for upgrades
  plusSizeTires?: PlusSizeTireOption[];
  
  // Surrogate vehicle for fitment API (shares bolt pattern/offset)
  surrogateVehicle?: SurrogateVehicle;
  
  // Whether we have aftermarket search profile
  hasAftermarketProfile: boolean;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGING
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Messaging for Jake
  confidenceMessage: string;
  warningMessage?: string;
  verifyPrompt?: string;      // What to ask customer to verify
  
  // Safety labels
  safetyNotes?: string[];     // e.g., ["Final clearance should be verified"]
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TRACKING
  // ═══════════════════════════════════════════════════════════════════════════
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
// CURATED OEM + AFTERMARKET REFERENCE DATA
// This is hand-curated data for common vehicles missing from our DB
// ============================================================================

interface CuratedVehicleData {
  // OEM specs
  boltPattern: string;
  centerBore: number;
  threadSize?: string;
  tireSizes: { size: string; trims?: string[] }[];
  wheelDiameters: number[];
  wheelWidths: number[];
  offsetRange: { min: number; max: number };
  platform?: string;
  sharedWith?: string[];
  notes?: string;
  
  // AFTERMARKET PROFILE (new)
  aftermarket?: {
    // Safe upgrade diameters
    safeDiameters: number[];
    // Detailed hints per diameter
    wheelHints: {
      diameter: number;
      widths: number[];
      offsetRange: { min: number; max: number };
      notes?: string;
    }[];
    // Plus-size tire options
    plusSizeTires: {
      size: string;
      wheelDiameter: number;
      notes?: string;
    }[];
    // Surrogate vehicle for API searches
    surrogateVehicle?: {
      year: number;
      make: string;
      model: string;
      trim?: string;
      reason: string;
    };
  };
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
        threadSize: "12x1.5",
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
        // FULL AFTERMARKET PROFILE
        aftermarket: {
          safeDiameters: [19, 20, 22],
          wheelHints: [
            {
              diameter: 19,
              widths: [8, 8.5],
              offsetRange: { min: 35, max: 45 },
              notes: "Direct fit, no modifications needed",
            },
            {
              diameter: 20,
              widths: [8, 8.5, 9],
              offsetRange: { min: 35, max: 45 },
              notes: "Popular upgrade size, may need minor trimming on some widths",
            },
            {
              diameter: 22,
              widths: [8.5, 9],
              offsetRange: { min: 30, max: 42 },
              notes: "Aggressive upgrade, verify fender clearance",
            },
          ],
          plusSizeTires: [
            { size: "245/40R19", wheelDiameter: 19, notes: "Direct plus-size, no speedo change" },
            { size: "245/40R20", wheelDiameter: 20, notes: "Common 20\" upgrade size" },
            { size: "255/35R20", wheelDiameter: 20, notes: "Wider option for aggressive stance" },
            { size: "255/40R20", wheelDiameter: 20, notes: "More sidewall for comfort" },
            { size: "265/30R22", wheelDiameter: 22, notes: "22\" stretch fit" },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern, similar offset range",
          },
        },
      },
    },
  ],
  "cadillac|deville": [
    {
      yearRange: [2000, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["Base", "DHS"] },
          { size: "235/55R17", trims: ["DTS"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body",
        sharedWith: ["Buick Park Avenue", "Oldsmobile Aurora"],
        aftermarket: {
          safeDiameters: [18, 19, 20],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5, 9], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
            { size: "255/35R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  "cadillac|seville": [
    {
      yearRange: [1998, 2004],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["SLS"] },
          { size: "235/55R17", trims: ["STS"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 48 },
        platform: "GM G-body",
        aftermarket: {
          safeDiameters: [18, 19, 20],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  "cadillac|eldorado": [
    {
      yearRange: [1992, 2002],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["Base", "ESC"] },
          { size: "235/60R16", trims: ["ETC"] },
        ],
        wheelDiameters: [16],
        wheelWidths: [7],
        offsetRange: { min: 38, max: 46 },
        platform: "GM E-body",
        sharedWith: ["Oldsmobile Toronado"],
        aftermarket: {
          safeDiameters: [17, 18, 19, 20],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 38, max: 48 } },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "225/55R17", wheelDiameter: 17 },
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
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
        threadSize: "12x1.5",
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
        aftermarket: {
          safeDiameters: [19, 20, 22],
          wheelHints: [
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5, 9], offsetRange: { min: 35, max: 45 } },
            { diameter: 22, widths: [8.5, 9], offsetRange: { min: 30, max: 42 } },
          ],
          plusSizeTires: [
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
            { size: "255/35R20", wheelDiameter: 20 },
            { size: "265/30R22", wheelDiameter: 22 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  "buick|lesabre": [
    {
      yearRange: [2000, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["Custom", "Limited"] },
        ],
        wheelDiameters: [16],
        wheelWidths: [6.5, 7],
        offsetRange: { min: 40, max: 48 },
        platform: "GM H-body",
        sharedWith: ["Pontiac Bonneville", "Oldsmobile 88"],
        aftermarket: {
          safeDiameters: [17, 18, 19, 20],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 38, max: 48 } },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "225/55R17", wheelDiameter: 17 },
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  "buick|park avenue": [
    {
      yearRange: [1997, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["Base"] },
          { size: "235/55R17", trims: ["Ultra"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body",
        sharedWith: ["Cadillac DeVille"],
        aftermarket: {
          safeDiameters: [18, 19, 20],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
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
        threadSize: "1/2x20",
        tireSizes: [
          { size: "225/60R17", trims: ["Executive", "Signature"] },
          { size: "235/55R17", trims: ["Signature L", "Designer"] },
        ],
        wheelDiameters: [17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "Ford Panther",
        sharedWith: ["Ford Crown Victoria", "Mercury Grand Marquis"],
        aftermarket: {
          safeDiameters: [18, 19, 20, 22],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5, 9], offsetRange: { min: 35, max: 45 } },
            { diameter: 22, widths: [8.5, 9], offsetRange: { min: 30, max: 42 } },
          ],
          plusSizeTires: [
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
            { size: "255/35R20", wheelDiameter: 20 },
            { size: "265/30R22", wheelDiameter: 22 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Ford",
            model: "Crown Victoria",
            reason: "Same Panther platform, 5x114.3 bolt pattern",
          },
        },
      },
    },
    {
      yearRange: [1998, 2002],
      data: {
        boltPattern: "5x114.3",
        centerBore: 70.5,
        threadSize: "1/2x20",
        tireSizes: [
          { size: "225/60R16", trims: ["Executive", "Signature"] },
          { size: "225/60R17", trims: ["Cartier"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7],
        offsetRange: { min: 38, max: 48 },
        platform: "Ford Panther",
        sharedWith: ["Ford Crown Victoria", "Mercury Grand Marquis"],
        aftermarket: {
          safeDiameters: [17, 18, 19, 20],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 38, max: 48 } },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "225/55R17", wheelDiameter: 17 },
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Ford",
            model: "Crown Victoria",
            reason: "Same Panther platform, 5x114.3 bolt pattern",
          },
        },
      },
    },
  ],
  "lincoln|continental": [
    {
      yearRange: [2017, 2020],
      data: {
        boltPattern: "5x114.3",
        centerBore: 63.4,
        threadSize: "14x1.5",
        tireSizes: [
          { size: "245/45R19", trims: ["Premiere", "Select"] },
          { size: "245/40R20", trims: ["Reserve", "Black Label"] },
        ],
        wheelDiameters: [19, 20],
        wheelWidths: [8, 8.5],
        offsetRange: { min: 40, max: 50 },
        platform: "Ford CD4",
        sharedWith: ["Ford Fusion", "Lincoln MKZ"],
        aftermarket: {
          safeDiameters: [20, 21, 22],
          wheelHints: [
            { diameter: 20, widths: [8.5, 9], offsetRange: { min: 38, max: 48 } },
            { diameter: 21, widths: [8.5, 9, 9.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 22, widths: [9, 9.5], offsetRange: { min: 32, max: 42 } },
          ],
          plusSizeTires: [
            { size: "255/35R20", wheelDiameter: 20 },
            { size: "255/30R21", wheelDiameter: 21 },
            { size: "265/30R22", wheelDiameter: 22 },
          ],
          surrogateVehicle: {
            year: 2019,
            make: "Ford",
            model: "Fusion",
            reason: "Same CD4 platform, 5x114.3 bolt pattern",
          },
        },
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
        threadSize: "1/2x20",
        tireSizes: [
          { size: "225/60R16", trims: ["GS"] },
          { size: "225/60R17", trims: ["LS"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7],
        offsetRange: { min: 38, max: 48 },
        platform: "Ford Panther",
        sharedWith: ["Ford Crown Victoria", "Lincoln Town Car"],
        aftermarket: {
          safeDiameters: [18, 19, 20, 22],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5, 9], offsetRange: { min: 35, max: 45 } },
            { diameter: 22, widths: [8.5, 9], offsetRange: { min: 30, max: 42 } },
          ],
          plusSizeTires: [
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
            { size: "265/30R22", wheelDiameter: 22 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Ford",
            model: "Crown Victoria",
            reason: "Same Panther platform, 5x114.3 bolt pattern",
          },
        },
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
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["3.5"] },
          { size: "235/55R17", trims: ["4.0"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM G-body",
        sharedWith: ["Buick Park Avenue", "Cadillac DeVille"],
        aftermarket: {
          safeDiameters: [18, 19, 20],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  "oldsmobile|alero": [
    {
      yearRange: [1999, 2004],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "215/60R15", trims: ["GX"] },
          { size: "225/50R16", trims: ["GL", "GLS"] },
        ],
        wheelDiameters: [15, 16],
        wheelWidths: [6, 6.5],
        offsetRange: { min: 35, max: 45 },
        platform: "GM N-body",
        sharedWith: ["Pontiac Grand Am", "Chevrolet Malibu"],
        aftermarket: {
          safeDiameters: [17, 18],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "225/45R17", wheelDiameter: 17 },
            { size: "225/40R18", wheelDiameter: 18 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
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
        threadSize: "14x1.5",
        tireSizes: [
          { size: "245/45R18", trims: ["Base"] },
          { size: "245/40R19", trims: ["GT", "GXP"] },
        ],
        wheelDiameters: [18, 19],
        wheelWidths: [8, 8.5],
        offsetRange: { min: 35, max: 45 },
        platform: "GM Zeta",
        sharedWith: ["Chevrolet SS", "Holden Commodore"],
        aftermarket: {
          safeDiameters: [19, 20, 22],
          wheelHints: [
            { diameter: 19, widths: [8.5, 9, 9.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [9, 9.5, 10], offsetRange: { min: 30, max: 42 } },
            { diameter: 22, widths: [9, 9.5, 10], offsetRange: { min: 25, max: 38 } },
          ],
          plusSizeTires: [
            { size: "275/35R19", wheelDiameter: 19 },
            { size: "275/30R20", wheelDiameter: 20 },
            { size: "285/30R20", wheelDiameter: 20 },
            { size: "285/25R22", wheelDiameter: 22 },
          ],
          surrogateVehicle: {
            year: 2017,
            make: "Chevrolet",
            model: "SS",
            reason: "Same Zeta platform, 5x120 bolt pattern",
          },
        },
      },
    },
  ],
  "pontiac|grand prix": [
    {
      yearRange: [2004, 2008],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
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
        aftermarket: {
          safeDiameters: [18, 19, 20],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5, 9], offsetRange: { min: 32, max: 42 } },
          ],
          plusSizeTires: [
            { size: "235/45R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  "pontiac|bonneville": [
    {
      yearRange: [2000, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["SE"] },
          { size: "235/55R17", trims: ["SLE", "GXP"] },
        ],
        wheelDiameters: [16, 17],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM H-body",
        sharedWith: ["Buick LeSabre"],
        aftermarket: {
          safeDiameters: [18, 19, 20],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "235/50R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  // GM U-body minivans (Transport, Montana)
  "pontiac|transport": [
    {
      yearRange: [1997, 1998],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "215/70R15", trims: ["SE"] },
          { size: "225/60R16", trims: ["SE", "GT"] },
        ],
        wheelDiameters: [15, 16],
        wheelWidths: [6, 6.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM U-body",
        sharedWith: ["Chevrolet Venture", "Oldsmobile Silhouette"],
        notes: "GM minivan, replaced by Montana",
        aftermarket: {
          safeDiameters: [17, 18],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 38, max: 48 }, notes: "Popular upgrade" },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 }, notes: "Max recommended for minivan" },
          ],
          plusSizeTires: [
            { size: "225/55R17", wheelDiameter: 17 },
            { size: "225/50R18", wheelDiameter: 18 },
            { size: "235/50R18", wheelDiameter: 18 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  "pontiac|montana": [
    {
      yearRange: [1999, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "215/70R15", trims: ["Base"] },
          { size: "225/60R16", trims: ["Base", "Thunder"] },
        ],
        wheelDiameters: [15, 16],
        wheelWidths: [6, 6.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM U-body",
        sharedWith: ["Chevrolet Venture", "Oldsmobile Silhouette", "Pontiac Transport"],
        notes: "GM minivan, successor to Transport",
        aftermarket: {
          safeDiameters: [17, 18],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 38, max: 48 }, notes: "Popular upgrade" },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 }, notes: "Max recommended for minivan" },
          ],
          plusSizeTires: [
            { size: "225/55R17", wheelDiameter: 17 },
            { size: "225/50R18", wheelDiameter: 18 },
            { size: "235/50R18", wheelDiameter: 18 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CHEVROLET (common 5x115 vehicles)
  // ═══════════════════════════════════════════════════════════════════════════
  "chevrolet|impala": [
    {
      yearRange: [2006, 2013],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["LS", "LT"] },
          { size: "235/55R17", trims: ["LT", "LTZ"] },
          { size: "235/50R18", trims: ["LTZ", "SS"] },
        ],
        wheelDiameters: [16, 17, 18],
        wheelWidths: [6.5, 7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM W-body",
        sharedWith: ["Pontiac Grand Prix", "Buick LaCrosse"],
        aftermarket: {
          safeDiameters: [19, 20, 22],
          wheelHints: [
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5, 9], offsetRange: { min: 35, max: 45 } },
            { diameter: 22, widths: [8.5, 9], offsetRange: { min: 30, max: 42 } },
          ],
          plusSizeTires: [
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
            { size: "255/35R20", wheelDiameter: 20 },
            { size: "265/30R22", wheelDiameter: 22 },
          ],
        },
      },
    },
  ],
  "chevrolet|monte carlo": [
    {
      yearRange: [2000, 2007],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/60R16", trims: ["LS"] },
          { size: "225/55R17", trims: ["LT"] },
          { size: "235/50R18", trims: ["SS"] },
        ],
        wheelDiameters: [16, 17, 18],
        wheelWidths: [6.5, 7, 7.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM W-body",
        sharedWith: ["Chevrolet Impala"],
        aftermarket: {
          safeDiameters: [19, 20],
          wheelHints: [
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5, 9], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/40R20", wheelDiameter: 20 },
            { size: "255/35R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same W-body platform, 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  // GM U-body minivan
  "chevrolet|venture": [
    {
      yearRange: [1997, 2005],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "215/70R15", trims: ["Base", "LS"] },
          { size: "225/60R16", trims: ["LT", "Warner Bros"] },
        ],
        wheelDiameters: [15, 16],
        wheelWidths: [6, 6.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM U-body",
        sharedWith: ["Pontiac Montana", "Pontiac Transport", "Oldsmobile Silhouette"],
        notes: "GM minivan, replaced by Uplander",
        aftermarket: {
          safeDiameters: [17, 18],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 38, max: 48 }, notes: "Popular upgrade" },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 }, notes: "Max recommended for minivan" },
          ],
          plusSizeTires: [
            { size: "225/55R17", wheelDiameter: 17 },
            { size: "225/50R18", wheelDiameter: 18 },
            { size: "235/50R18", wheelDiameter: 18 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
      },
    },
  ],
  
  // ═══════════════════════════════════════════════════════════════════════════
  // OLDSMOBILE (discontinued brand)
  // ═══════════════════════════════════════════════════════════════════════════
  "oldsmobile|silhouette": [
    {
      yearRange: [1997, 2004],
      data: {
        boltPattern: "5x115",
        centerBore: 70.3,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "215/70R15", trims: ["GL", "GLS"] },
          { size: "225/60R16", trims: ["GLS", "Premiere"] },
        ],
        wheelDiameters: [15, 16],
        wheelWidths: [6, 6.5],
        offsetRange: { min: 40, max: 50 },
        platform: "GM U-body",
        sharedWith: ["Chevrolet Venture", "Pontiac Montana", "Pontiac Transport"],
        notes: "GM minivan, discontinued with Oldsmobile brand",
        aftermarket: {
          safeDiameters: [17, 18],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 38, max: 48 }, notes: "Popular upgrade" },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 }, notes: "Max recommended for minivan" },
          ],
          plusSizeTires: [
            { size: "225/55R17", wheelDiameter: 17 },
            { size: "225/50R18", wheelDiameter: 18 },
            { size: "235/50R18", wheelDiameter: 18 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Impala",
            reason: "Same 5x115 bolt pattern",
          },
        },
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
        threadSize: "12x1.5",
        tireSizes: [
          { size: "225/50R17", trims: ["XE", "XR"] },
          { size: "235/50R18", trims: ["XR"] },
        ],
        wheelDiameters: [17, 18],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 48 },
        platform: "GM Epsilon II",
        sharedWith: ["Chevrolet Malibu", "Pontiac G6"],
        aftermarket: {
          safeDiameters: [18, 19, 20],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "235/45R18", wheelDiameter: 18 },
            { size: "245/40R19", wheelDiameter: 19 },
            { size: "245/35R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2012,
            make: "Chevrolet",
            model: "Malibu",
            reason: "Same Epsilon II platform, 5x110 bolt pattern",
          },
        },
      },
    },
  ],
  "saturn|outlook": [
    {
      yearRange: [2007, 2010],
      data: {
        boltPattern: "6x132",
        centerBore: 74.5,
        threadSize: "12x1.5",
        tireSizes: [
          { size: "255/65R18", trims: ["XE", "XR"] },
          { size: "255/60R19", trims: ["XR"] },
        ],
        wheelDiameters: [18, 19],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 45, max: 55 },
        platform: "GM Lambda",
        sharedWith: ["GMC Acadia", "Buick Enclave", "Chevrolet Traverse"],
        aftermarket: {
          safeDiameters: [20, 22],
          wheelHints: [
            { diameter: 20, widths: [8, 8.5], offsetRange: { min: 40, max: 52 } },
            { diameter: 22, widths: [8.5, 9], offsetRange: { min: 38, max: 50 } },
          ],
          plusSizeTires: [
            { size: "255/50R20", wheelDiameter: 20 },
            { size: "285/40R22", wheelDiameter: 22 },
          ],
          surrogateVehicle: {
            year: 2015,
            make: "GMC",
            model: "Acadia",
            reason: "Same Lambda platform, 6x132 bolt pattern",
          },
        },
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
        threadSize: "12x1.5",
        tireSizes: [
          { size: "265/75R16", trims: ["Base"] },
          { size: "285/75R16", trims: ["H3T", "Adventure"] },
        ],
        wheelDiameters: [16],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 30, max: 40 },
        platform: "GM GMT355",
        sharedWith: ["Chevrolet Colorado", "GMC Canyon"],
        aftermarket: {
          safeDiameters: [17, 18, 20],
          wheelHints: [
            { diameter: 17, widths: [8, 8.5, 9], offsetRange: { min: 10, max: 30 } },
            { diameter: 18, widths: [8.5, 9], offsetRange: { min: 10, max: 25 } },
            { diameter: 20, widths: [9, 10], offsetRange: { min: 0, max: 20 } },
          ],
          plusSizeTires: [
            { size: "285/70R17", wheelDiameter: 17 },
            { size: "285/65R18", wheelDiameter: 18 },
            { size: "305/55R20", wheelDiameter: 20 },
          ],
          surrogateVehicle: {
            year: 2010,
            make: "Chevrolet",
            model: "Colorado",
            reason: "Same GMT355 platform, 6x139.7 bolt pattern",
          },
        },
      },
    },
  ],
  "hummer|h2": [
    {
      yearRange: [2003, 2009],
      data: {
        boltPattern: "8x165.1",
        centerBore: 121,
        threadSize: "14x1.5",
        tireSizes: [
          { size: "315/70R17", trims: ["Base", "Luxury"] },
        ],
        wheelDiameters: [17],
        wheelWidths: [8.5],
        offsetRange: { min: 20, max: 35 },
        platform: "GM GMT820",
        sharedWith: ["Chevrolet Silverado 2500", "GMC Sierra 2500"],
        aftermarket: {
          safeDiameters: [20, 22, 24],
          wheelHints: [
            { diameter: 20, widths: [9, 10, 12], offsetRange: { min: -12, max: 25 } },
            { diameter: 22, widths: [10, 12], offsetRange: { min: -25, max: 15 } },
            { diameter: 24, widths: [10, 12, 14], offsetRange: { min: -40, max: 0 } },
          ],
          plusSizeTires: [
            { size: "305/55R20", wheelDiameter: 20 },
            { size: "305/45R22", wheelDiameter: 22 },
            { size: "305/35R24", wheelDiameter: 24 },
          ],
          surrogateVehicle: {
            year: 2007,
            make: "Chevrolet",
            model: "Silverado 2500HD",
            reason: "Same 8x165.1 bolt pattern, similar offset",
          },
        },
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
        threadSize: "12x1.5",
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
        aftermarket: {
          safeDiameters: [18, 19],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 42 } },
          ],
          plusSizeTires: [
            { size: "235/40R18", wheelDiameter: 18 },
            { size: "235/35R19", wheelDiameter: 19 },
          ],
          surrogateVehicle: {
            year: 2012,
            make: "Chevrolet",
            model: "Malibu",
            reason: "Same Epsilon platform, 5x110 bolt pattern",
          },
        },
      },
    },
  ],
  "saab|9-5": [
    {
      yearRange: [1999, 2009],
      data: {
        boltPattern: "5x110",
        centerBore: 65.1,
        threadSize: "12x1.5",
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
        aftermarket: {
          safeDiameters: [18, 19],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 35, max: 45 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 42 } },
          ],
          plusSizeTires: [
            { size: "235/40R18", wheelDiameter: 18 },
            { size: "245/35R19", wheelDiameter: 19 },
          ],
          surrogateVehicle: {
            year: 2012,
            make: "Chevrolet",
            model: "Malibu",
            reason: "Similar 5x110 bolt pattern",
          },
        },
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
        threadSize: "12x1.25",
        tireSizes: [
          { size: "225/70R16", trims: ["Base"] },
          { size: "225/65R17", trims: ["Premium", "Luxury"] },
          { size: "235/60R18", trims: ["Limited"] },
        ],
        wheelDiameters: [16, 17, 18],
        wheelWidths: [6.5, 7],
        offsetRange: { min: 40, max: 50 },
        aftermarket: {
          safeDiameters: [17, 18, 19],
          wheelHints: [
            { diameter: 17, widths: [7, 7.5], offsetRange: { min: 40, max: 50 } },
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "225/60R17", wheelDiameter: 17 },
            { size: "235/55R18", wheelDiameter: 18 },
            { size: "245/50R19", wheelDiameter: 19 },
          ],
        },
      },
    },
  ],
  "suzuki|kizashi": [
    {
      yearRange: [2010, 2013],
      data: {
        boltPattern: "5x114.3",
        centerBore: 60.1,
        threadSize: "12x1.25",
        tireSizes: [
          { size: "215/55R17", trims: ["S", "SE"] },
          { size: "225/50R18", trims: ["GTS", "SLS"] },
        ],
        wheelDiameters: [17, 18],
        wheelWidths: [7, 7.5],
        offsetRange: { min: 40, max: 50 },
        aftermarket: {
          safeDiameters: [18, 19],
          wheelHints: [
            { diameter: 18, widths: [7.5, 8], offsetRange: { min: 38, max: 48 } },
            { diameter: 19, widths: [8, 8.5], offsetRange: { min: 35, max: 45 } },
          ],
          plusSizeTires: [
            { size: "225/45R18", wheelDiameter: 18 },
            { size: "235/40R19", wheelDiameter: 19 },
          ],
        },
      },
    },
  ],
};

// ============================================================================
// ERA-BASED COMMON SPECS (fallback for unknown vehicles)
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
        
        // Build aftermarket profile if available
        const hasAftermarket = !!data.aftermarket;
        
        let wheelSearchHints: AftermarketWheelHint[] | undefined;
        let plusSizeTires: PlusSizeTireOption[] | undefined;
        let surrogateVehicle: SurrogateVehicle | undefined;
        let safeAftermarketDiameters: number[] | undefined;
        
        if (data.aftermarket) {
          safeAftermarketDiameters = data.aftermarket.safeDiameters;
          
          wheelSearchHints = data.aftermarket.wheelHints.map(hint => ({
            diameter: hint.diameter,
            widths: hint.widths,
            offsetRange: hint.offsetRange,
            label: "fallback_upgrade" as FitmentLabel,
            notes: hint.notes,
          }));
          
          plusSizeTires = data.aftermarket.plusSizeTires.map(tire => ({
            size: tire.size,
            wheelDiameter: tire.wheelDiameter,
            label: "fallback_upgrade" as FitmentLabel,
            notes: tire.notes,
          }));
          
          if (data.aftermarket.surrogateVehicle) {
            surrogateVehicle = {
              ...data.aftermarket.surrogateVehicle,
            };
          }
        }
        
        // Build safety notes
        const safetyNotes: string[] = [];
        if (hasAftermarket) {
          safetyNotes.push("Upgrade specs are common aftermarket guidance, not verified OEM");
          safetyNotes.push("Final clearance should be verified before installation");
        }
        
        return {
          success: true,
          confidence: "high",
          source: "curated_oem",
          boltPattern: data.boltPattern,
          boltPatternMetric: data.boltPattern,
          centerBore: data.centerBore,
          threadSize: data.threadSize,
          tireSizes,
          wheelDiameters: data.wheelDiameters,
          wheelWidths: data.wheelWidths,
          offsetRange: data.offsetRange,
          platform: data.platform,
          sharedWith: data.sharedWith,
          
          // Aftermarket profile
          hasAftermarketProfile: hasAftermarket,
          safeAftermarketDiameters,
          wheelSearchHints,
          plusSizeTires,
          surrogateVehicle,
          
          // Messaging
          confidenceMessage: `I don't have this exact vehicle in my verified database yet, but the ${year} ${make} ${model} commonly uses:`,
          safetyNotes,
          vehicleKey,
          lookupTimestamp: Date.now(),
        };
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: Era-based inference
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
      hasAftermarketProfile: false,
      confidenceMessage: `I don't have specific data for the ${year} ${make} ${model}, but based on similar vehicles from that era, common sizes are:`,
      warningMessage: "These are estimates. I'd recommend checking your door sticker or current tires for the exact size.",
      verifyPrompt: "Could you check the tire size on your door jamb sticker or the sidewall of your current tires? It'll look something like 235/55R17.",
      safetyNotes: ["These are general estimates only - verify your specific vehicle specs"],
      vehicleKey,
      lookupTimestamp: Date.now(),
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: Can't determine - ask customer
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    success: false,
    confidence: "unknown",
    source: "customer_verify",
    hasAftermarketProfile: false,
    confidenceMessage: `I don't have specific fitment data for the ${year} ${make} ${model} in my system yet.`,
    warningMessage: "But I can definitely still help you!",
    verifyPrompt: "If you can tell me the tire size from your door jamb sticker (something like 235/55R17), I can find great options for you. Or if you know your wheel bolt pattern, I can help with wheels too!",
    safetyNotes: [],
    vehicleKey,
    lookupTimestamp: Date.now(),
  };
}

// ============================================================================
// ASYNC LOOKUP WITH EXTERNAL API
// ============================================================================

/**
 * Extended result type that includes external lookup and research metadata
 */
export interface FallbackFitmentResultWithExternal extends FallbackFitmentResult {
  // External API lookup metadata
  externalLookupAttempted?: boolean;
  externalLookupSucceeded?: boolean;
  externalLookupSource?: string;
  externalLookupCached?: boolean;
  externalLookupDurationMs?: number;
  
  // Trusted research metadata (NEW)
  trustedResearchAttempted?: boolean;
  trustedResearchSucceeded?: boolean;
  trustedResearchConfidence?: string;
  trustedResearchSources?: string[];
  trustedResearchDurationMs?: number;
  
  // Trim clarification (for research results)
  requiresTrimClarification?: boolean;
  availableTrims?: string[];
  trimQuestion?: string;
}

/**
 * Async version that tries curated fallback first, then external API lookup
 * 
 * Use this when you need the full lookup chain including external API.
 * The sync `lookupFallbackFitment` is still available for fast curated-only lookups.
 */
export async function lookupFallbackFitmentWithExternal(
  request: FallbackLookupRequest
): Promise<FallbackFitmentResultWithExternal> {
  const { year, make, model, trim } = request;
  const vehicleKey = `${year}|${make}|${model}`;
  
  // STEP 1: Try curated fallback (sync, fast)
  const curatedResult = lookupFallbackFitment(request);
  
  // If curated fallback succeeded with HIGH or MEDIUM confidence, return it
  // (Don't return low confidence "era_common" guesses - try external first)
  if (curatedResult.success && 
      (curatedResult.confidence === "high" || curatedResult.confidence === "medium")) {
    return {
      ...curatedResult,
      externalLookupAttempted: false,
    };
  }
  
  // STEP 2: Curated failed - try external Wheel-Size API lookup
  console.log(`[fallback-service] Curated fallback failed for ${year} ${make} ${model}, trying external lookup...`);
  
  let externalResult: ExternalLookupResult | null = null;
  try {
    externalResult = await lookupExternalFitment({ year, make, model, trim });
  } catch (err) {
    console.error(`[fallback-service] External lookup error:`, err);
    // Don't return early - try trusted research instead
    externalResult = null;
  }
  
  // If external lookup failed or errored, try trusted research
  if (!externalResult || !externalResult.success || !externalResult.fitment) {
    const failReason = externalResult?.messaging?.confidenceNote || "External lookup threw an error";
    console.log(`[fallback-service] External lookup failed: ${failReason}`);
    console.log(`[fallback-service] Trying trusted research for ${year} ${make} ${model}...`);
    
    // STEP 3: Try AI-assisted trusted research
    let researchResult: TrustedResearchResult;
    try {
      researchResult = await researchTrustedFitment({ year, make, model, trim });
    } catch (err) {
      console.error(`[fallback-service] Trusted research error:`, err);
      // Return the original curated result
      return {
        ...curatedResult,
        externalLookupAttempted: true,
        externalLookupSucceeded: false,
        externalLookupSource: externalResult?.sourceName,
        trustedResearchAttempted: true,
        trustedResearchSucceeded: false,
      };
    }
    
    // If research failed, return the curated result
    if (!researchResult.success || !researchResult.fitment) {
      console.log(`[fallback-service] Trusted research failed: ${researchResult.messaging.confidenceNote}`);
      return {
        ...curatedResult,
        externalLookupAttempted: true,
        externalLookupSucceeded: false,
        trustedResearchAttempted: true,
        trustedResearchSucceeded: false,
        trustedResearchDurationMs: researchResult.researchDurationMs,
      };
    }
    
    // STEP 4: Research succeeded - build result
    console.log(`[fallback-service] Trusted research succeeded for ${year} ${make} ${model}, confidence: ${researchResult.confidence}`);
    
    const researchFitment = researchResult.fitment;
    const researchConfidence: FallbackConfidence = researchResult.confidence === "high" 
      ? "high" 
      : researchResult.confidence === "medium"
      ? "medium"
      : "low";
    
    // Build tire sizes from research
    const tireSizes = researchFitment.commonTireSizes?.map(size => ({
      size,
      isOem: true,
    })) || researchFitment.trims?.map(t => ({
      size: t.tireSize,
      isOem: true,
      trimLevel: t.trim,
    })) || [];
    
    return {
      success: true,
      confidence: researchConfidence,
      source: "curated_oem", // Label as reference data
      
      // Core fitment
      boltPattern: researchFitment.boltPattern,
      centerBore: researchFitment.centerBore,
      threadSize: researchFitment.threadSize,
      tireSizes,
      wheelDiameters: researchFitment.commonWheelDiameters,
      wheelWidths: researchFitment.trims?.map(t => t.wheelWidth).filter((v, i, a) => a.indexOf(v) === i),
      offsetRange: researchFitment.offsetRange,
      
      // Aftermarket profile if available
      hasAftermarketProfile: !!researchFitment.aftermarketSearchProfile,
      safeAftermarketDiameters: researchFitment.aftermarketSearchProfile?.safeUpgradeDiameters,
      wheelSearchHints: researchFitment.aftermarketSearchProfile?.wheelHintsByDiameter?.map(h => ({
        diameter: h.diameter,
        widths: h.widths,
        offsetRange: h.offsetRange,
        label: "fallback_upgrade" as FitmentLabel,
      })),
      plusSizeTires: researchFitment.aftermarketSearchProfile?.plusSizeTireOptions?.map(t => ({
        size: t.size,
        wheelDiameter: t.wheelDiameter,
        label: "fallback_upgrade" as FitmentLabel,
      })),
      
      // Messaging
      confidenceMessage: researchResult.messaging.formatted,
      warningMessage: researchResult.requiresCustomerVerification 
        ? "This is researched data - verify your tire size for best results."
        : undefined,
      verifyPrompt: researchResult.messaging.trimQuestion || (
        researchResult.requiresCustomerVerification
          ? "Can you confirm the tire size from your door jamb sticker?"
          : undefined
      ),
      safetyNotes: ["Researched reference data - verify before purchase"],
      
      vehicleKey,
      lookupTimestamp: Date.now(),
      
      // Metadata
      externalLookupAttempted: true,
      externalLookupSucceeded: false,
      trustedResearchAttempted: true,
      trustedResearchSucceeded: true,
      trustedResearchConfidence: researchResult.confidence,
      trustedResearchSources: researchResult.sourcesUsed,
      trustedResearchDurationMs: researchResult.researchDurationMs,
      
      // Trim clarification
      requiresTrimClarification: researchResult.requiresTrimClarification,
      availableTrims: researchResult.availableTrims,
      trimQuestion: researchResult.messaging.trimQuestion,
    };
  }
  
  // STEP 3 (alt): External lookup succeeded - build result
  console.log(`[fallback-service] External lookup succeeded for ${year} ${make} ${model}`);
  
  const fitment = externalResult.fitment;
  
  // Map external confidence to our confidence type
  const confidence: FallbackConfidence = externalResult.confidence === "high" 
    ? "high" 
    : externalResult.confidence === "medium"
    ? "medium"
    : "low";
  
  // Build tire sizes array
  const tireSizes = fitment.tireSizes.map(size => ({
    size,
    isOem: true, // From external OEM data
  }));
  
  // Build the result
  const result: FallbackFitmentResultWithExternal = {
    success: true,
    confidence,
    source: "curated_oem", // Label as OEM since it's from Wheel-Size
    
    // Core fitment data
    boltPattern: fitment.boltPattern,
    boltPatternMetric: fitment.boltPatternMetric,
    centerBore: fitment.centerBore,
    threadSize: fitment.threadSize,
    tireSizes,
    wheelDiameters: fitment.wheelDiameters,
    wheelWidths: fitment.wheelWidths,
    offsetRange: fitment.offsetRange,
    
    // No aftermarket profile from external lookup (would need to be curated)
    hasAftermarketProfile: false,
    
    // Messaging
    confidenceMessage: externalResult.confidence === "high"
      ? `I don't have the ${year} ${make} ${model} in my verified database yet, but I found OEM reference data from Wheel-Size.com:`
      : `I found some reference data for the ${year} ${make} ${model}:`,
    warningMessage: externalResult.requiresCustomerVerification
      ? "This is reference data - I'd recommend verifying your tire size on the door sticker."
      : undefined,
    verifyPrompt: externalResult.requiresCustomerVerification
      ? "Can you confirm the tire size from your door jamb sticker? It helps me give you the best recommendations."
      : undefined,
    safetyNotes: externalResult.requiresCustomerVerification
      ? ["External reference data - verify before purchase"]
      : [],
    
    // Metadata
    vehicleKey,
    lookupTimestamp: Date.now(),
    
    // External lookup metadata
    externalLookupAttempted: true,
    externalLookupSucceeded: true,
    externalLookupSource: externalResult.sourceName,
    externalLookupCached: externalResult.cached,
    externalLookupDurationMs: externalResult.lookupDurationMs,
  };
  
  return result;
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
  canSearchAftermarketWheels: boolean;
  reason?: string;
} {
  const canSearchTires = !!(result.tireSizes && result.tireSizes.length > 0);
  const canSearchWheels = !!(result.boltPattern && result.wheelDiameters?.length);
  const canSearchAftermarketWheels = !!(result.hasAftermarketProfile && result.wheelSearchHints?.length);
  
  return {
    canSearchTires,
    canSearchWheels,
    canSearchAftermarketWheels,
    reason: !canSearchTires && !canSearchWheels 
      ? "Need tire size or bolt pattern from customer" 
      : undefined,
  };
}

/**
 * Get wheel search hints for a specific diameter
 */
export function getWheelSearchHintForDiameter(
  result: FallbackFitmentResult,
  diameter: number
): AftermarketWheelHint | null {
  if (!result.wheelSearchHints) return null;
  return result.wheelSearchHints.find(h => h.diameter === diameter) || null;
}

/**
 * Get plus-size tire options for a specific wheel diameter
 */
export function getPlusSizeTiresForDiameter(
  result: FallbackFitmentResult,
  diameter: number
): PlusSizeTireOption[] {
  if (!result.plusSizeTires) return [];
  return result.plusSizeTires.filter(t => t.wheelDiameter === diameter);
}

/**
 * Check if a specific diameter is safe for aftermarket upgrade
 */
export function isDiameterSafeForUpgrade(
  result: FallbackFitmentResult,
  diameter: number
): boolean {
  if (!result.safeAftermarketDiameters) return false;
  return result.safeAftermarketDiameters.includes(diameter);
}
