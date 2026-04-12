/**
 * WHEEL FITMENT INTEGRITY AUDIT
 * 
 * Comprehensive audit of all vehicle wheel fitment records (2000-2026)
 * Checks for data integrity issues in:
 * - Bolt pattern
 * - Center bore
 * - Thread size
 * - Wheel diameter range
 * - Wheel width range
 * - Offset range
 * 
 * Usage: npx tsx scripts/fitment-audit/wheel-fitment-audit.ts
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
import * as fs from "fs/promises";

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type WheelIssueType = 
  | "exact_safe"              // No issues detected
  | "plausible_shared"        // Shared fitment, looks valid
  | "sibling_aggregation"     // Multiple trims grouped
  | "broad_plus_size_range"   // Wide range but valid for plus-sizing
  | "min_diameter_below_oem"  // Diameter below expected OEM baseline
  | "offset_range_too_broad"  // Offset range unrealistic (>20mm spread)
  | "width_range_too_broad"   // Width range unrealistic (>3" spread)
  | "cross_gen_contamination" // Wrong-era specs inherited
  | "suspicious_bolt_pattern" // Bolt pattern doesn't match expected
  | "suspicious_center_bore"  // Center bore doesn't match expected
  | "suspicious_thread_size"  // Thread size doesn't match expected
  | "missing_wheel_specs"     // No wheel sizes defined
  | "needs_trim_override";    // Needs manual override for specific trim

interface WheelSize {
  diameter: number;
  width: number;
  offset?: number;
  axle?: string;
  isStock?: boolean;
}

interface WheelAuditRecord {
  id: string;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  modificationId: string;
  boltPattern: string | null;
  centerBoreMm: number | null;
  threadSize: string | null;
  seatType: string | null;
  offsetMinMm: number | null;
  offsetMaxMm: number | null;
  oemWheelSizes: WheelSize[];
  oemTireSizes: string[];
  source: string;
  issueTypes: WheelIssueType[];
  issueDetails: string[];
  isTruckSuv: boolean;
  isSportsCar: boolean;
  isLuxury: boolean;
  // Computed metrics
  diameterRange: [number, number] | null;
  widthRange: [number, number] | null;
  offsetRange: [number, number] | null;
  diameterSpread: number;
  widthSpread: number;
  offsetSpread: number;
}

interface WheelAuditSummary {
  timestamp: string;
  totalRecords: number;
  cleanCount: number;
  flaggedCount: number;
  byIssueType: Record<WheelIssueType, number>;
  byYear: Record<number, { total: number; flagged: number }>;
  byMake: Record<string, { total: number; flagged: number }>;
  byModel: Record<string, { total: number; flagged: number }>;
  bySource: Record<string, { total: number; flagged: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// VEHICLE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

const TRUCKS_SUVS = [
  'silverado', 'sierra', 'f-150', 'f-250', 'f-350', 'ram', '1500', '2500', '3500',
  'tundra', 'tacoma', 'titan', 'frontier', 'colorado', 'canyon', 'ranger', 'maverick',
  'tahoe', 'yukon', 'suburban', 'expedition', 'navigator', 'escalade',
  'durango', 'grand-cherokee', '4runner', 'sequoia', 'land-cruiser', 'gx', 'lx',
  'highlander', 'pilot', 'passport', 'telluride', 'palisade', 'atlas', 'traverse',
  'blazer', 'trailblazer', 'equinox', 'terrain', 'acadia', 'explorer', 'bronco',
  'wrangler', 'gladiator', 'defender', 'range-rover', 'discovery', 'promaster'
];

const SPORTS_CARS = [
  'corvette', 'camaro', 'mustang', 'challenger', 'charger', '370z', '350z', 'supra',
  'gt-r', 'wrx', 'sti', 'brz', '86', 'gr86', 'miata', 'mx-5', 'cayman', 'boxster', '911',
  'amg-gt', 'm2', 'm3', 'm4', 'm5', 'm8', 'rs3', 'rs5', 'rs6', 'rs7', 'r8',
  'viper', 'type-r', 'nsx', 'stinger'
];

const LUXURY_BRANDS = [
  'mercedes-benz', 'mercedes', 'bmw', 'audi', 'lexus', 'infiniti', 'acura', 'cadillac', 
  'lincoln', 'genesis', 'porsche', 'jaguar', 'land-rover', 'maserati', 
  'bentley', 'rolls-royce', 'aston-martin', 'ferrari', 'lamborghini', 'mclaren'
];

function isTruckSuv(model: string): boolean {
  return TRUCKS_SUVS.some(t => model.toLowerCase().includes(t));
}

function isSportsCar(model: string): boolean {
  return SPORTS_CARS.some(s => model.toLowerCase().includes(s));
}

function isLuxuryBrand(make: string): boolean {
  return LUXURY_BRANDS.some(l => make.toLowerCase().includes(l));
}

// ═══════════════════════════════════════════════════════════════════════════
// KNOWN BOLT PATTERNS BY MAKE (for validation)
// ═══════════════════════════════════════════════════════════════════════════

const EXPECTED_BOLT_PATTERNS: Record<string, string[]> = {
  // American
  "ford": ["5x114.3", "5x120", "6x135", "8x170", "5x108", "4x108", "5x4.5", "5x135"],
  "chevrolet": ["5x120", "5x127", "6x139.7", "8x180", "5x115", "5x4.75", "5x100", "4x100", "8x165.1", "5x114.3"],
  "gmc": ["5x120", "6x139.7", "8x180", "5x127", "8x165.1"],
  "ram": ["5x139.7", "6x139.7", "8x165.1"],
  "dodge": ["5x115", "5x127", "5x139.7", "6x139.7", "5x100", "4x100", "8x165.1", "6x114.3"],
  "chrysler": ["5x115", "5x127", "5x114.3", "5x100"],
  "jeep": ["5x127", "5x114.3", "6x139.7", "5x5"],
  "cadillac": ["5x120", "6x139.7", "5x115"],
  "lincoln": ["5x114.3", "6x135", "5x120", "5x108"],
  "buick": ["5x120", "5x115", "5x114.3"],
  
  // Japanese
  "toyota": ["5x114.3", "6x139.7", "5x100", "5x150", "4x100"],
  "honda": ["5x114.3", "5x120", "4x100", "5x100"],
  "nissan": ["5x114.3", "6x139.7", "5x120", "4x114.3", "4x100"],
  "mazda": ["5x114.3", "4x100", "5x100", "4x110"],
  "subaru": ["5x114.3", "5x100"],
  "lexus": ["5x114.3", "5x120", "5x150"],
  "infiniti": ["5x114.3", "5x120"],
  "acura": ["5x114.3", "5x120", "4x100"],
  "mitsubishi": ["5x114.3", "6x139.7", "4x100", "5x114.3"],
  
  // Korean
  "hyundai": ["5x114.3", "5x120", "4x100", "4x114.3"],
  "kia": ["5x114.3", "5x120", "4x100"],
  "genesis": ["5x114.3", "5x120"],
  
  // German
  "bmw": ["5x120", "5x112"],
  "mercedes": ["5x112"],
  "mercedes-benz": ["5x112"],
  "audi": ["5x112", "5x100"],
  "volkswagen": ["5x112", "5x100", "4x100"],
  "porsche": ["5x130", "5x112"],
  
  // European
  "volvo": ["5x108", "5x114.3"],
  "jaguar": ["5x108", "5x120"],
  "land-rover": ["5x120"],
  "mini": ["5x112", "4x100"],
  "alfa-romeo": ["5x110"],
  "fiat": ["5x98", "5x110", "4x98"],
  
  // Performance/Exotic
  "ferrari": ["5x108", "5x114.3"],
  "lamborghini": ["5x112", "5x120"],
  "maserati": ["5x114.3", "5x108"],
  "aston-martin": ["5x114.3"],
  "mclaren": ["5x112"],
  "bentley": ["5x112", "5x130"],
  "rolls-royce": ["5x120"],
  
  // Electric
  "tesla": ["5x120", "5x114.3"],
  "rivian": ["6x135"],
  "lucid": ["5x114.3"],
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPECTED SPECIFICATIONS BY VEHICLE CLASS
// ═══════════════════════════════════════════════════════════════════════════

interface VehicleClassSpec {
  minDiameter: number;
  maxDiameter: number;
  minWidth: number;
  maxWidth: number;
  offsetRange: [number, number];
  centerBoreRange: [number, number];
}

const VEHICLE_CLASS_SPECS: Record<string, VehicleClassSpec> = {
  sportsCar: {
    minDiameter: 17,
    maxDiameter: 22,
    minWidth: 7,
    maxWidth: 12,
    offsetRange: [15, 60],
    centerBoreRange: [54, 74],
  },
  truckSuv: {
    minDiameter: 16,
    maxDiameter: 24,
    minWidth: 6.5,
    maxWidth: 12,
    offsetRange: [-25, 55],
    centerBoreRange: [70, 130], // HD trucks can have 121mm+ center bore
  },
  hdTruck: {  // Heavy-duty trucks (2500/3500)
    minDiameter: 17,
    maxDiameter: 24,
    minWidth: 6.5,
    maxWidth: 12,
    offsetRange: [-25, 55],
    centerBoreRange: [110, 135], // 8-lug HD trucks
  },
  luxury: {
    minDiameter: 17,
    maxDiameter: 22,
    minWidth: 7,
    maxWidth: 11,
    offsetRange: [20, 55],
    centerBoreRange: [56, 74],
  },
  economy: {
    minDiameter: 15,
    maxDiameter: 20,
    minWidth: 5.5,
    maxWidth: 9,
    offsetRange: [30, 55],
    centerBoreRange: [54, 72],
  },
  compact: {  // Subcompact/economy with 4-lug
    minDiameter: 14,
    maxDiameter: 18,
    minWidth: 5,
    maxWidth: 7.5,
    offsetRange: [30, 55],
    centerBoreRange: [54, 60],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MINIMUM OEM DIAMETER BY MODEL (for key vehicles)
// ═══════════════════════════════════════════════════════════════════════════

const MIN_OEM_DIAMETERS: Record<string, Record<string, number>> = {
  // Sports cars (aggressive minimums)
  "chevrolet/corvette": { "2020": 19, "2014": 18, "2005": 17, "1997": 17, "0": 15 },
  "chevrolet/camaro": { "2016": 18, "2010": 18, "0": 16 },
  "ford/mustang": { "2024": 17, "2015": 17, "0": 15 },
  "dodge/challenger": { "2015": 18, "2008": 17, "0": 17 },
  "dodge/charger": { "2015": 18, "2006": 17, "0": 15 },
  "nissan/370z": { "2009": 18, "0": 17 },
  "nissan/gt-r": { "2009": 20, "0": 20 },
  "subaru/wrx": { "2022": 17, "2015": 17, "0": 16 },
  "subaru/brz": { "2022": 17, "0": 17 },
  "toyota/gr86": { "2022": 17, "0": 17 },
  "mazda/mx-5-miata": { "2016": 16, "0": 14 },
  "porsche/911": { "2012": 19, "0": 17 },
  
  // Trucks (work truck minimums)
  "ford/f-150": { "2021": 17, "2015": 17, "0": 16 },
  "ford/f-250": { "2020": 17, "0": 16 },
  "ford/f-350": { "2020": 17, "0": 16 },
  "chevrolet/silverado-1500": { "2019": 17, "2014": 17, "0": 16 },
  "chevrolet/silverado-2500hd": { "2020": 17, "0": 16 },
  "chevrolet/silverado-3500hd": { "2020": 17, "0": 16 },
  "gmc/sierra-1500": { "2019": 17, "2014": 17, "0": 16 },
  "gmc/sierra-2500hd": { "2020": 17, "0": 16 },
  "gmc/sierra-3500hd": { "2020": 17, "0": 16 },
  "ram/1500": { "2019": 17, "0": 16 },
  "ram/2500": { "2019": 17, "0": 16 },
  "ram/3500": { "2019": 17, "0": 16 },
  "toyota/tacoma": { "2016": 16, "0": 15 },
  "toyota/tundra": { "2022": 18, "2007": 17, "0": 16 },
  
  // Luxury - more lenient for older years
  "bmw/3-series": { "2019": 17, "2012": 16, "0": 15 },
  "bmw/5-series": { "2017": 17, "0": 16 },
  "mercedes/c-class": { "2015": 17, "0": 15 },
  "mercedes/e-class": { "2017": 17, "0": 16 },
  "audi/a4": { "2017": 17, "2009": 16, "0": 15 },
  "audi/a3": { "2015": 16, "0": 15 },
  "audi/a6": { "2012": 17, "0": 16 },
  "lexus/is": { "2021": 18, "2014": 17, "0": 16 },
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getMinOemDiameter(make: string, model: string, year: number, boltPattern?: string | null): number {
  const key = `${make.toLowerCase()}/${model.toLowerCase()}`;
  const modelDiameters = MIN_OEM_DIAMETERS[key];
  
  if (modelDiameters) {
    const thresholds = Object.entries(modelDiameters)
      .map(([y, d]) => [parseInt(y), d] as [number, number])
      .sort((a, b) => b[0] - a[0]);
    
    for (const [threshold, diameter] of thresholds) {
      if (year >= threshold) return diameter;
    }
  }
  
  // Compact/economy cars with 4-lug have smaller wheel options
  if (boltPattern && boltPattern.startsWith('4x')) {
    if (year >= 2020) return 15;
    if (year >= 2010) return 14;
    return 13;
  }
  
  // Fallback by vehicle class
  if (isSportsCar(model)) {
    if (year >= 2020) return 17;
    if (year >= 2010) return 16;
    return 15;
  }
  
  if (isTruckSuv(model)) {
    if (year >= 2020) return 17;
    if (year >= 2015) return 16;
    return 15;
  }
  
  if (isLuxuryBrand(make)) {
    if (year >= 2020) return 17;
    if (year >= 2015) return 16;
    return 15;
  }
  
  // Economy default - more lenient for older vehicles
  if (year >= 2020) return 16;
  if (year >= 2015) return 15;
  if (year >= 2010) return 15;
  return 14;
}

function parseWheelSizes(oemWheelSizes: any): WheelSize[] {
  if (!oemWheelSizes || !Array.isArray(oemWheelSizes)) return [];
  
  return oemWheelSizes.map((ws: any) => {
    // Handle string format like "17x7.5" or "18x8.5 ET45"
    if (typeof ws === 'string') {
      const match = ws.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
      if (match) {
        const offsetMatch = ws.match(/ET\s*(-?\d+)/i);
        return {
          diameter: parseFloat(match[1]),
          width: parseFloat(match[2]),
          offset: offsetMatch ? parseInt(offsetMatch[1]) : undefined,
        };
      }
      return null;
    }
    
    // Handle object format
    if (typeof ws === 'object' && ws !== null) {
      return {
        diameter: parseFloat(ws.diameter || ws.rim_diameter || 0),
        width: parseFloat(ws.width || ws.rim_width || 0),
        offset: ws.offset != null ? parseFloat(ws.offset) : undefined,
        axle: ws.axle,
        isStock: ws.isStock ?? ws.is_stock,
      };
    }
    
    return null;
  }).filter((ws): ws is WheelSize => ws !== null && ws.diameter > 0);
}

function getDiameterRange(wheelSizes: WheelSize[]): [number, number] | null {
  const diameters = wheelSizes.map(ws => ws.diameter).filter(d => d > 0);
  if (diameters.length === 0) return null;
  return [Math.min(...diameters), Math.max(...diameters)];
}

function getWidthRange(wheelSizes: WheelSize[]): [number, number] | null {
  const widths = wheelSizes.map(ws => ws.width).filter(w => w > 0);
  if (widths.length === 0) return null;
  return [Math.min(...widths), Math.max(...widths)];
}

function getOffsetRangeFromWheelSizes(wheelSizes: WheelSize[]): [number, number] | null {
  const offsets = wheelSizes.map(ws => ws.offset).filter((o): o is number => o !== undefined);
  if (offsets.length === 0) return null;
  return [Math.min(...offsets), Math.max(...offsets)];
}

function parseBoltPattern(bp: string | null): { lugs: number; pcd: number } | null {
  if (!bp) return null;
  const match = bp.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { lugs: parseInt(match[1]), pcd: parseFloat(match[2]) };
}

function hasTrimAggregation(displayTrim: string): boolean {
  // Check if multiple trims are grouped
  return displayTrim.includes(',') || 
         displayTrim.includes(' / ') ||
         displayTrim.includes(' | ') ||
         (displayTrim.split(/\s+/).length > 5 && displayTrim.includes(' '));
}

// ═══════════════════════════════════════════════════════════════════════════
// ISSUE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

function classifyRecord(row: any): WheelAuditRecord {
  const oemWheelSizes = parseWheelSizes(row.oem_wheel_sizes);
  const oemTireSizes = (row.oem_tire_sizes || []) as string[];
  
  const diameterRange = getDiameterRange(oemWheelSizes);
  const widthRange = getWidthRange(oemWheelSizes);
  const wheelOffsetRange = getOffsetRangeFromWheelSizes(oemWheelSizes);
  
  // Use wheel sizes offset range, or fall back to table offset range
  const offsetRange: [number, number] | null = wheelOffsetRange || 
    (row.offset_min_mm != null && row.offset_max_mm != null 
      ? [parseFloat(row.offset_min_mm), parseFloat(row.offset_max_mm)] 
      : null);
  
  const diameterSpread = diameterRange ? diameterRange[1] - diameterRange[0] : 0;
  const widthSpread = widthRange ? widthRange[1] - widthRange[0] : 0;
  const offsetSpread = offsetRange ? offsetRange[1] - offsetRange[0] : 0;
  
  const truck = isTruckSuv(row.model);
  const sports = isSportsCar(row.model);
  const luxury = isLuxuryBrand(row.make);
  
  const record: WheelAuditRecord = {
    id: row.id,
    year: row.year,
    make: row.make,
    model: row.model,
    displayTrim: row.display_trim || "Base",
    modificationId: row.modification_id,
    boltPattern: row.bolt_pattern,
    centerBoreMm: row.center_bore_mm ? parseFloat(row.center_bore_mm) : null,
    threadSize: row.thread_size,
    seatType: row.seat_type,
    offsetMinMm: row.offset_min_mm ? parseFloat(row.offset_min_mm) : null,
    offsetMaxMm: row.offset_max_mm ? parseFloat(row.offset_max_mm) : null,
    oemWheelSizes,
    oemTireSizes,
    source: row.source || "unknown",
    issueTypes: [],
    issueDetails: [],
    isTruckSuv: truck,
    isSportsCar: sports,
    isLuxury: luxury,
    diameterRange,
    widthRange,
    offsetRange,
    diameterSpread,
    widthSpread,
    offsetSpread,
  };
  
  // Check for issues
  const issues: WheelIssueType[] = [];
  const details: string[] = [];
  
  // 1. Missing wheel specs
  if (oemWheelSizes.length === 0) {
    issues.push("missing_wheel_specs");
    details.push("No OEM wheel sizes defined");
  }
  
  // 2. Sibling aggregation
  if (hasTrimAggregation(record.displayTrim)) {
    issues.push("sibling_aggregation");
    details.push(`Multiple trims grouped: ${record.displayTrim}`);
  }
  
  // 3. Minimum diameter below OEM baseline
  if (diameterRange) {
    const expectedMin = getMinOemDiameter(row.make, row.model, row.year, row.bolt_pattern);
    if (diameterRange[0] < expectedMin) {
      issues.push("min_diameter_below_oem");
      details.push(`Min diameter ${diameterRange[0]}" < expected ${expectedMin}" for ${row.year} ${row.model}`);
    }
  }
  
  // 4. Diameter spread too wide (>5" is suspicious for single trim)
  if (diameterSpread > 5 && !hasTrimAggregation(record.displayTrim)) {
    issues.push("broad_plus_size_range");
    details.push(`${diameterSpread}" diameter spread (${diameterRange![0]}" to ${diameterRange![1]}")`);
  }
  
  // 5. Width range too broad (>3" is suspicious)
  if (widthSpread > 3) {
    issues.push("width_range_too_broad");
    details.push(`${widthSpread}" width spread (${widthRange![0]}" to ${widthRange![1]}")`);
  }
  
  // 6. Offset range too broad (>25mm is suspicious for single trim)
  if (offsetSpread > 25 && !hasTrimAggregation(record.displayTrim)) {
    issues.push("offset_range_too_broad");
    details.push(`${offsetSpread}mm offset spread (${offsetRange![0]}mm to ${offsetRange![1]}mm)`);
  }
  
  // 7. Bolt pattern validation
  if (record.boltPattern) {
    const expectedPatterns = EXPECTED_BOLT_PATTERNS[row.make.toLowerCase()];
    if (expectedPatterns && !expectedPatterns.includes(record.boltPattern)) {
      // Check if it's a close match (e.g., 5x114.3 vs 5x4.5)
      const parsed = parseBoltPattern(record.boltPattern);
      if (parsed) {
        const hasClose = expectedPatterns.some(ep => {
          const parsedExpected = parseBoltPattern(ep);
          if (!parsedExpected) return false;
          // Same lug count, PCD within 1mm or equivalent (4.5" = 114.3mm)
          if (parsed.lugs !== parsedExpected.lugs) return false;
          const diff = Math.abs(parsed.pcd - parsedExpected.pcd);
          return diff < 1 || Math.abs(parsed.pcd - parsedExpected.pcd * 25.4) < 1;
        });
        if (!hasClose) {
          issues.push("suspicious_bolt_pattern");
          details.push(`Bolt pattern ${record.boltPattern} unexpected for ${row.make} (expected: ${expectedPatterns.join(", ")})`);
        }
      }
    }
  }
  
  // 8. Center bore validation
  if (record.centerBoreMm) {
    // Detect HD trucks (2500/3500), compacts (4-lug), and body-on-frame SUVs
    const isHdTruck = row.model.match(/2500|3500|hd/i) || 
                      (record.boltPattern && record.boltPattern.startsWith('8x'));
    const isCompact = record.boltPattern && record.boltPattern.startsWith('4x');
    // Body-on-frame SUVs with 6-lug often have larger center bores
    const isTruckBasedSuv = record.boltPattern && record.boltPattern.startsWith('6x');
    
    let classSpec;
    if (isHdTruck) {
      classSpec = VEHICLE_CLASS_SPECS.hdTruck;
    } else if (isCompact) {
      classSpec = VEHICLE_CLASS_SPECS.compact;
    } else if (isTruckBasedSuv || truck) {
      classSpec = VEHICLE_CLASS_SPECS.truckSuv;
    } else if (sports) {
      classSpec = VEHICLE_CLASS_SPECS.sportsCar;
    } else if (luxury) {
      classSpec = VEHICLE_CLASS_SPECS.luxury;
    } else {
      classSpec = VEHICLE_CLASS_SPECS.economy;
    }
    
    // More lenient check: allow 15mm below min and 20mm above max
    if (record.centerBoreMm < classSpec.centerBoreRange[0] - 15 || 
        record.centerBoreMm > classSpec.centerBoreRange[1] + 20) {
      issues.push("suspicious_center_bore");
      details.push(`Center bore ${record.centerBoreMm}mm outside expected range for vehicle class`);
    }
  }
  
  // 9. Cross-generation contamination (very small diameters on modern cars)
  // Skip for 4-lug compact cars which legitimately have smaller wheels
  const isCompactCar = record.boltPattern && record.boltPattern.startsWith('4x');
  if (diameterRange && row.year >= 2015 && !isCompactCar) {
    if ((sports && diameterRange[0] < 16) ||
        (!sports && !truck && diameterRange[0] < 14)) {
      issues.push("cross_gen_contamination");
      details.push(`Likely inherited old-gen specs: ${diameterRange[0]}" on ${row.year} vehicle`);
    }
  }
  
  // If no issues found, mark as safe
  if (issues.length === 0) {
    if (oemWheelSizes.length === 1) {
      issues.push("exact_safe");
      details.push("Single exact wheel spec");
    } else if (oemWheelSizes.length > 1 && diameterSpread <= 2) {
      issues.push("plausible_shared");
      details.push("Multiple specs with reasonable spread");
    } else {
      issues.push("exact_safe");
      details.push("Specs within expected ranges");
    }
  }
  
  record.issueTypes = issues;
  record.issueDetails = details;
  
  return record;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN AUDIT
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("           WHEEL FITMENT INTEGRITY AUDIT (2000-2026)          ");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  try {
    // Fetch all records
    const { rows } = await pool.query(`
      SELECT id, year, make, model, display_trim, modification_id,
             bolt_pattern, center_bore_mm, thread_size, seat_type,
             offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
      ORDER BY year, make, model, display_trim
    `);
    
    console.log(`Auditing ${rows.length} records...\n`);
    
    // Process all records
    const records: WheelAuditRecord[] = rows.map(row => classifyRecord(row));
    
    // Build summary
    const summary: WheelAuditSummary = {
      timestamp: new Date().toISOString(),
      totalRecords: records.length,
      cleanCount: 0,
      flaggedCount: 0,
      byIssueType: {} as Record<WheelIssueType, number>,
      byYear: {},
      byMake: {},
      byModel: {},
      bySource: {},
    };
    
    // Initialize issue type counts
    const issueTypes: WheelIssueType[] = [
      "exact_safe", "plausible_shared", "sibling_aggregation", "broad_plus_size_range",
      "min_diameter_below_oem", "offset_range_too_broad", "width_range_too_broad",
      "cross_gen_contamination", "suspicious_bolt_pattern", "suspicious_center_bore",
      "suspicious_thread_size", "missing_wheel_specs", "needs_trim_override"
    ];
    issueTypes.forEach(t => summary.byIssueType[t] = 0);
    
    // Example records for each issue type
    const examples: Record<WheelIssueType, WheelAuditRecord[]> = {} as any;
    issueTypes.forEach(t => examples[t] = []);
    
    // Process records
    for (const record of records) {
      const isFlagged = !record.issueTypes.includes("exact_safe") && 
                        !record.issueTypes.includes("plausible_shared");
      
      if (isFlagged) {
        summary.flaggedCount++;
      } else {
        summary.cleanCount++;
      }
      
      // Count by issue type
      for (const issue of record.issueTypes) {
        summary.byIssueType[issue]++;
        if (examples[issue].length < 5) {
          examples[issue].push(record);
        }
      }
      
      // Count by year
      if (!summary.byYear[record.year]) {
        summary.byYear[record.year] = { total: 0, flagged: 0 };
      }
      summary.byYear[record.year].total++;
      if (isFlagged) summary.byYear[record.year].flagged++;
      
      // Count by make
      if (!summary.byMake[record.make]) {
        summary.byMake[record.make] = { total: 0, flagged: 0 };
      }
      summary.byMake[record.make].total++;
      if (isFlagged) summary.byMake[record.make].flagged++;
      
      // Count by model
      const modelKey = `${record.make}/${record.model}`;
      if (!summary.byModel[modelKey]) {
        summary.byModel[modelKey] = { total: 0, flagged: 0 };
      }
      summary.byModel[modelKey].total++;
      if (isFlagged) summary.byModel[modelKey].flagged++;
      
      // Count by source
      if (!summary.bySource[record.source]) {
        summary.bySource[record.source] = { total: 0, flagged: 0 };
      }
      summary.bySource[record.source].total++;
      if (isFlagged) summary.bySource[record.source].flagged++;
    }
    
    // Print summary
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                         SUMMARY                                ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    console.log(`Total Records: ${summary.totalRecords}`);
    console.log(`Clean/Safe: ${summary.cleanCount} (${(summary.cleanCount / summary.totalRecords * 100).toFixed(1)}%)`);
    console.log(`Flagged: ${summary.flaggedCount} (${(summary.flaggedCount / summary.totalRecords * 100).toFixed(1)}%)\n`);
    
    console.log("BY ISSUE TYPE:");
    Object.entries(summary.byIssueType)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const pct = (count / summary.totalRecords * 100).toFixed(1);
        const icon = type.includes("safe") || type.includes("plausible") ? "✅" : "⚠️";
        console.log(`  ${icon} ${type}: ${count} (${pct}%)`);
      });
    
    console.log("\nTOP 10 AFFECTED MAKES:");
    Object.entries(summary.byMake)
      .sort((a, b) => b[1].flagged - a[1].flagged)
      .slice(0, 10)
      .forEach(([make, stats]) => {
        console.log(`  ${make}: ${stats.flagged}/${stats.total} flagged`);
      });
    
    console.log("\nTOP 10 AFFECTED MODELS:");
    Object.entries(summary.byModel)
      .sort((a, b) => b[1].flagged - a[1].flagged)
      .slice(0, 10)
      .forEach(([model, stats]) => {
        console.log(`  ${model}: ${stats.flagged}/${stats.total} flagged`);
      });
    
    // Print examples
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("                    EXAMPLES BY ISSUE TYPE                      ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    const criticalIssues: WheelIssueType[] = [
      "missing_wheel_specs", "cross_gen_contamination", "min_diameter_below_oem",
      "suspicious_bolt_pattern", "suspicious_center_bore", "offset_range_too_broad",
      "width_range_too_broad", "sibling_aggregation"
    ];
    
    for (const issueType of criticalIssues) {
      if (examples[issueType].length > 0) {
        console.log(`--- ${issueType.toUpperCase()} ---`);
        for (const ex of examples[issueType].slice(0, 3)) {
          console.log(`${ex.year} ${ex.make} ${ex.model} "${ex.displayTrim}"`);
          if (ex.boltPattern) console.log(`  Bolt: ${ex.boltPattern}`);
          if (ex.centerBoreMm) console.log(`  Center bore: ${ex.centerBoreMm}mm`);
          if (ex.diameterRange) console.log(`  Diameters: ${ex.diameterRange[0]}" - ${ex.diameterRange[1]}"`);
          if (ex.widthRange) console.log(`  Widths: ${ex.widthRange[0]}" - ${ex.widthRange[1]}"`);
          if (ex.offsetRange) console.log(`  Offsets: ${ex.offsetRange[0]}mm - ${ex.offsetRange[1]}mm`);
          console.log(`  Issue: ${ex.issueDetails.join("; ")}`);
          console.log();
        }
      }
    }
    
    // Save results
    const outputDir = path.resolve(__dirname);
    
    // JSON output
    const jsonPath = path.join(outputDir, "wheel-audit-results.json");
    await fs.writeFile(jsonPath, JSON.stringify({
      summary,
      records: records.map(r => ({
        ...r,
        oemWheelSizes: r.oemWheelSizes.length, // Don't include full array in JSON
      })),
      examples,
    }, null, 2));
    console.log(`📄 JSON saved to: ${jsonPath}`);
    
    // CSV output
    const csvPath = path.join(outputDir, "wheel-audit-results.csv");
    const csvHeader = [
      "year", "make", "model", "display_trim", "bolt_pattern", "center_bore_mm",
      "thread_size", "offset_min", "offset_max", "diameter_min", "diameter_max",
      "width_min", "width_max", "wheel_count", "source", "issue_types", "issue_details"
    ].join(",");
    
    const csvRows = records.map(r => [
      r.year,
      `"${r.make}"`,
      `"${r.model}"`,
      `"${r.displayTrim.replace(/"/g, '""')}"`,
      `"${r.boltPattern || ''}"`,
      r.centerBoreMm || '',
      `"${r.threadSize || ''}"`,
      r.offsetMinMm || r.offsetRange?.[0] || '',
      r.offsetMaxMm || r.offsetRange?.[1] || '',
      r.diameterRange?.[0] || '',
      r.diameterRange?.[1] || '',
      r.widthRange?.[0] || '',
      r.widthRange?.[1] || '',
      r.oemWheelSizes.length,
      `"${r.source}"`,
      `"${r.issueTypes.join('; ')}"`,
      `"${r.issueDetails.join('; ').replace(/"/g, '""')}"`,
    ].join(","));
    
    await fs.writeFile(csvPath, [csvHeader, ...csvRows].join("\n"));
    console.log(`📄 CSV saved to: ${csvPath}`);
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
