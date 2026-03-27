/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BULK FITMENT IMPORT STRATEGY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Goal: Reduce reliance on Wheel-Size API by pre-populating vehicle_fitments
 * for high-demand vehicles.
 * 
 * Strategy:
 * 1. Identify top 500-1000 vehicles by US sales volume + search frequency
 * 2. Fetch fitment once per vehicle (all modifications)
 * 3. Normalize trim values for consistent display
 * 4. Track coverage metrics
 * 
 * Expected outcome:
 * - 80%+ of searches served from DB without API calls
 * - API usage reduced to ~50-100 calls/day (long-tail vehicles only)
 * 
 * @created 2026-03-27
 */

import { db, schema } from "./db";
import { sql, and, eq } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET VEHICLES - Top 500+ by US Sales Volume
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tier 1: Top 50 vehicles (25% of US market volume)
 * These should be pre-populated FIRST
 */
export const TIER_1_VEHICLES = [
  // Full-size trucks (highest volume)
  { make: "Ford", model: "F-150" },
  { make: "Chevrolet", model: "Silverado 1500" },
  { make: "RAM", model: "Ram 1500" },
  { make: "GMC", model: "Sierra 1500" },
  { make: "Toyota", model: "Tundra" },
  { make: "Nissan", model: "Titan" },
  
  // Mid-size trucks
  { make: "Toyota", model: "Tacoma" },
  { make: "Ford", model: "Ranger" },
  { make: "Chevrolet", model: "Colorado" },
  { make: "GMC", model: "Canyon" },
  { make: "Nissan", model: "Frontier" },
  { make: "Honda", model: "Ridgeline" },
  { make: "Jeep", model: "Gladiator" },
  { make: "Ford", model: "Maverick" },
  
  // Heavy-duty trucks
  { make: "Ford", model: "F-250" },
  { make: "Ford", model: "F-350" },
  { make: "Chevrolet", model: "Silverado 2500HD" },
  { make: "Chevrolet", model: "Silverado 3500HD" },
  { make: "RAM", model: "Ram 2500" },
  { make: "RAM", model: "Ram 3500" },
  { make: "GMC", model: "Sierra 2500HD" },
  { make: "GMC", model: "Sierra 3500HD" },
  
  // Top compact SUVs
  { make: "Toyota", model: "RAV4" },
  { make: "Honda", model: "CR-V" },
  { make: "Mazda", model: "CX-5" },
  { make: "Subaru", model: "Crosstrek" },
  { make: "Subaru", model: "Forester" },
  { make: "Hyundai", model: "Tucson" },
  { make: "Kia", model: "Sportage" },
  { make: "Nissan", model: "Rogue" },
  { make: "Ford", model: "Escape" },
  { make: "Chevrolet", model: "Equinox" },
  
  // Top mid-size SUVs
  { make: "Toyota", model: "Highlander" },
  { make: "Honda", model: "Pilot" },
  { make: "Ford", model: "Explorer" },
  { make: "Chevrolet", model: "Traverse" },
  { make: "Hyundai", model: "Santa Fe" },
  { make: "Kia", model: "Sorento" },
  { make: "Subaru", model: "Outback" },
  { make: "Mazda", model: "CX-9" },
  
  // Top full-size SUVs
  { make: "Chevrolet", model: "Tahoe" },
  { make: "Chevrolet", model: "Suburban" },
  { make: "GMC", model: "Yukon" },
  { make: "Ford", model: "Expedition" },
  { make: "Toyota", model: "Sequoia" },
  { make: "Nissan", model: "Armada" },
  
  // Iconic off-road
  { make: "Jeep", model: "Wrangler" },
  { make: "Jeep", model: "Grand Cherokee" },
  { make: "Toyota", model: "4Runner" },
  { make: "Ford", model: "Bronco" },
  { make: "Land Rover", model: "Defender" },
];

/**
 * Tier 2: Next 100 vehicles (additional 20% of market)
 */
export const TIER_2_VEHICLES = [
  // Additional SUVs
  { make: "Jeep", model: "Cherokee" },
  { make: "Jeep", model: "Compass" },
  { make: "Jeep", model: "Renegade" },
  { make: "Ford", model: "Bronco Sport" },
  { make: "Ford", model: "Edge" },
  { make: "Chevrolet", model: "Blazer" },
  { make: "Chevrolet", model: "Trailblazer" },
  { make: "Chevrolet", model: "Trax" },
  { make: "Honda", model: "Passport" },
  { make: "Honda", model: "HR-V" },
  { make: "Toyota", model: "Venza" },
  { make: "Nissan", model: "Pathfinder" },
  { make: "Nissan", model: "Murano" },
  { make: "Nissan", model: "Kicks" },
  { make: "Subaru", model: "Ascent" },
  { make: "Mazda", model: "CX-30" },
  { make: "Mazda", model: "CX-50" },
  { make: "Kia", model: "Telluride" },
  { make: "Kia", model: "Seltos" },
  { make: "Hyundai", model: "Palisade" },
  { make: "Hyundai", model: "Kona" },
  { make: "Volkswagen", model: "Atlas" },
  { make: "Volkswagen", model: "Tiguan" },
  { make: "Volkswagen", model: "Taos" },
  { make: "GMC", model: "Acadia" },
  { make: "GMC", model: "Terrain" },
  { make: "Buick", model: "Enclave" },
  { make: "Buick", model: "Envision" },
  { make: "Dodge", model: "Durango" },
  
  // Top sedans
  { make: "Toyota", model: "Camry" },
  { make: "Honda", model: "Civic" },
  { make: "Honda", model: "Accord" },
  { make: "Toyota", model: "Corolla" },
  { make: "Nissan", model: "Altima" },
  { make: "Nissan", model: "Sentra" },
  { make: "Hyundai", model: "Elantra" },
  { make: "Hyundai", model: "Sonata" },
  { make: "Kia", model: "Forte" },
  { make: "Kia", model: "K5" },
  { make: "Mazda", model: "Mazda3" },
  { make: "Mazda", model: "Mazda6" },
  { make: "Subaru", model: "Impreza" },
  { make: "Subaru", model: "Legacy" },
  { make: "Volkswagen", model: "Jetta" },
  { make: "Volkswagen", model: "Passat" },
  { make: "Chevrolet", model: "Malibu" },
  
  // EVs
  { make: "Tesla", model: "Model Y" },
  { make: "Tesla", model: "Model 3" },
  { make: "Tesla", model: "Model X" },
  { make: "Tesla", model: "Model S" },
  { make: "Ford", model: "Mustang Mach-E" },
  { make: "Chevrolet", model: "Bolt EV" },
  { make: "Hyundai", model: "Ioniq 5" },
  { make: "Hyundai", model: "Ioniq 6" },
  { make: "Kia", model: "EV6" },
  { make: "Volkswagen", model: "ID.4" },
  { make: "Rivian", model: "R1T" },
  { make: "Rivian", model: "R1S" },
  { make: "Tesla", model: "Cybertruck" },
  
  // Sports/Performance
  { make: "Ford", model: "Mustang" },
  { make: "Chevrolet", model: "Camaro" },
  { make: "Chevrolet", model: "Corvette" },
  { make: "Dodge", model: "Challenger" },
  { make: "Dodge", model: "Charger" },
  { make: "Subaru", model: "WRX" },
  
  // Minivans
  { make: "Toyota", model: "Sienna" },
  { make: "Honda", model: "Odyssey" },
  { make: "Chrysler", model: "Pacifica" },
  { make: "Kia", model: "Carnival" },
  
  // Luxury SUVs
  { make: "Lexus", model: "RX" },
  { make: "Lexus", model: "NX" },
  { make: "Lexus", model: "GX" },
  { make: "Acura", model: "MDX" },
  { make: "Acura", model: "RDX" },
  { make: "BMW", model: "X3" },
  { make: "BMW", model: "X5" },
  { make: "Mercedes-Benz", model: "GLE" },
  { make: "Mercedes-Benz", model: "GLC" },
  { make: "Audi", model: "Q5" },
  { make: "Audi", model: "Q7" },
  { make: "Volvo", model: "XC90" },
  { make: "Volvo", model: "XC60" },
  { make: "Cadillac", model: "Escalade" },
  { make: "Lincoln", model: "Navigator" },
  { make: "Lincoln", model: "Aviator" },
  { make: "Porsche", model: "Cayenne" },
  { make: "Porsche", model: "Macan" },
  { make: "Land Rover", model: "Range Rover" },
  { make: "Land Rover", model: "Range Rover Sport" },
  { make: "Genesis", model: "GV80" },
  { make: "Genesis", model: "GV70" },
  { make: "Infiniti", model: "QX60" },
  { make: "Infiniti", model: "QX80" },
];

/**
 * Tier 3: Additional high-volume vehicles
 */
export const TIER_3_VEHICLES = [
  // More luxury sedans
  { make: "BMW", model: "3 Series" },
  { make: "BMW", model: "5 Series" },
  { make: "Mercedes-Benz", model: "C-Class" },
  { make: "Mercedes-Benz", model: "E-Class" },
  { make: "Audi", model: "A4" },
  { make: "Audi", model: "A6" },
  { make: "Lexus", model: "ES" },
  { make: "Lexus", model: "IS" },
  { make: "Acura", model: "TLX" },
  { make: "Genesis", model: "G70" },
  { make: "Genesis", model: "G80" },
  { make: "Infiniti", model: "Q50" },
  { make: "Volvo", model: "S60" },
  { make: "Cadillac", model: "CT5" },
  
  // Additional SUVs
  { make: "BMW", model: "X1" },
  { make: "BMW", model: "X7" },
  { make: "Mercedes-Benz", model: "GLA" },
  { make: "Mercedes-Benz", model: "GLB" },
  { make: "Mercedes-Benz", model: "GLS" },
  { make: "Audi", model: "Q3" },
  { make: "Audi", model: "Q8" },
  { make: "Lexus", model: "UX" },
  { make: "Lexus", model: "LX" },
  { make: "Volvo", model: "XC40" },
  { make: "Cadillac", model: "XT4" },
  { make: "Cadillac", model: "XT5" },
  { make: "Cadillac", model: "XT6" },
  { make: "Lincoln", model: "Corsair" },
  { make: "Lincoln", model: "Nautilus" },
  { make: "Acura", model: "Integra" },
  
  // Wagoneer line
  { make: "Jeep", model: "Wagoneer" },
  { make: "Jeep", model: "Grand Wagoneer" },
  
  // More compact cars
  { make: "Toyota", model: "Prius" },
  { make: "Honda", model: "Insight" },
  { make: "Hyundai", model: "Venue" },
  { make: "Kia", model: "Soul" },
  { make: "Kia", model: "Niro" },
  { make: "Nissan", model: "Versa" },
  { make: "Nissan", model: "Leaf" },
  
  // Specialty
  { make: "Toyota", model: "GR86" },
  { make: "Subaru", model: "BRZ" },
  { make: "Mazda", model: "MX-5 Miata" },
  { make: "Porsche", model: "911" },
  { make: "Nissan", model: "Z" },
  { make: "Kia", model: "Stinger" },
  { make: "Toyota", model: "Supra" },
  
  // Pickup trucks (compact/specialty)
  { make: "Hyundai", model: "Santa Cruz" },
  
  // Land Rover additional
  { make: "Land Rover", model: "Discovery" },
  { make: "Land Rover", model: "Evoque" },
  
  // Alfa Romeo
  { make: "Alfa Romeo", model: "Giulia" },
  { make: "Alfa Romeo", model: "Stelvio" },
  
  // MINI
  { make: "MINI", model: "Cooper" },
  { make: "MINI", model: "Countryman" },
  
  // Hummer
  { make: "GMC", model: "Hummer EV" },
  
  // Cadillac EV
  { make: "Cadillac", model: "Lyriq" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR RANGES
// ═══════════════════════════════════════════════════════════════════════════════

export const IMPORT_YEARS = [
  2025, 2024, 2023, 2022, 2021, 2020, // Recent (highest priority)
  2019, 2018, 2017, 2016, 2015,       // Mid-age
  2014, 2013, 2012, 2011, 2010,       // Older but still common
];

// ═══════════════════════════════════════════════════════════════════════════════
// TRIM NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean and normalize trim display values
 */
export function normalizeTrimDisplay(rawTrim: string | null | undefined): string {
  if (!rawTrim) return "Base";
  
  let trim = rawTrim.trim();
  
  // Remove common noise patterns
  const noisePatterns = [
    /^\d+(\.\d+)?[LV]?\s*/i,           // Engine displacement at start
    /\s*\d+(\.\d+)?[LV]?\s*$/i,        // Engine displacement at end
    /\bFWD\b/gi,
    /\bAWD\b/gi,
    /\b4WD\b/gi,
    /\bRWD\b/gi,
    /\b2WD\b/gi,
    /\b4x4\b/gi,
    /\b4x2\b/gi,
    /\bAutomatic\b/gi,
    /\bManual\b/gi,
    /\bCVT\b/gi,
    /\bDCT\b/gi,
    /\s*\(\d{4}-\d{4}\)\s*/g,
    /\s*\(\d{4}\)\s*/g,
    /\s+/g,
  ];
  
  for (const pattern of noisePatterns) {
    trim = trim.replace(pattern, " ");
  }
  
  trim = trim.trim().replace(/\s+/g, " ");
  
  if (!trim || /^\d+$/.test(trim)) {
    return "Base";
  }
  
  return trim;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVERAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

export type CoverageStats = {
  totalTargetVehicles: number;
  populatedVehicles: number;
  coveragePercent: number;
  byTier: {
    tier1: { total: number; populated: number; percent: number };
    tier2: { total: number; populated: number; percent: number };
    tier3: { total: number; populated: number; percent: number };
  };
  byYear: Record<number, { total: number; populated: number; percent: number }>;
  estimatedSearchCoverage: number;
  estimatedApiReduction: number;
};

/**
 * Calculate current coverage statistics
 */
export async function calculateCoverage(): Promise<CoverageStats> {
  // Get all populated vehicles from DB
  const populatedQuery = await db
    .select({
      year: schema.vehicleFitments.year,
      make: schema.vehicleFitments.make,
      model: schema.vehicleFitments.model,
    })
    .from(schema.vehicleFitments)
    .groupBy(
      schema.vehicleFitments.year,
      schema.vehicleFitments.make,
      schema.vehicleFitments.model
    );

  // Create lookup set
  const populatedSet = new Set(
    populatedQuery.map(v => `${v.year}|${v.make.toLowerCase()}|${v.model.toLowerCase()}`)
  );

  const tiers = [
    { name: "tier1", vehicles: TIER_1_VEHICLES },
    { name: "tier2", vehicles: TIER_2_VEHICLES },
    { name: "tier3", vehicles: TIER_3_VEHICLES },
  ];

  const byTier: CoverageStats["byTier"] = {
    tier1: { total: 0, populated: 0, percent: 0 },
    tier2: { total: 0, populated: 0, percent: 0 },
    tier3: { total: 0, populated: 0, percent: 0 },
  };

  const byYear: CoverageStats["byYear"] = {};

  let totalTarget = 0;
  let totalPopulated = 0;

  for (const tier of tiers) {
    const tierKey = tier.name as keyof typeof byTier;
    let tierTotal = 0;
    let tierPopulated = 0;

    for (const vehicle of tier.vehicles) {
      for (const year of IMPORT_YEARS) {
        const key = `${year}|${vehicle.make.toLowerCase()}|${vehicle.model.toLowerCase()}`;
        tierTotal++;
        totalTarget++;

        if (!byYear[year]) {
          byYear[year] = { total: 0, populated: 0, percent: 0 };
        }
        byYear[year].total++;

        if (populatedSet.has(key)) {
          tierPopulated++;
          totalPopulated++;
          byYear[year].populated++;
        }
      }
    }

    byTier[tierKey] = {
      total: tierTotal,
      populated: tierPopulated,
      percent: tierTotal > 0 ? Math.round((tierPopulated / tierTotal) * 100) : 0,
    };
  }

  for (const year of Object.keys(byYear)) {
    const y = byYear[Number(year)];
    y.percent = y.total > 0 ? Math.round((y.populated / y.total) * 100) : 0;
  }

  const coveragePercent = totalTarget > 0 ? Math.round((totalPopulated / totalTarget) * 100) : 0;

  // Tier 1 = ~40% of searches, Tier 2 = ~35%, Tier 3 = ~15%, Long-tail = ~10%
  const estimatedSearchCoverage = Math.round(
    byTier.tier1.percent * 0.40 +
    byTier.tier2.percent * 0.35 +
    byTier.tier3.percent * 0.15
  );

  const estimatedApiReduction = estimatedSearchCoverage;

  return {
    totalTargetVehicles: totalTarget,
    populatedVehicles: totalPopulated,
    coveragePercent,
    byTier,
    byYear,
    estimatedSearchCoverage,
    estimatedApiReduction,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK IMPORT EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

export type BulkImportConfig = {
  tiers: ("tier1" | "tier2" | "tier3")[];
  years: number[];
  dryRun?: boolean;
  delayBetweenCalls?: number;
  stopOnError?: boolean;
  skipExisting?: boolean;
};

export type BulkImportProgress = {
  total: number;
  completed: number;
  success: number;
  skipped: number;
  failed: number;
  currentVehicle: string | null;
  errors: Array<{ vehicle: string; error: string }>;
  startedAt: Date;
  estimatedTimeRemaining: number | null;
};

export type BulkImportResult = {
  success: boolean;
  totalProcessed: number;
  imported: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: Array<{ vehicle: string; error: string }>;
  coverageAfter: CoverageStats;
};

/**
 * Get vehicles to import based on config
 */
export function getTargetVehicles(config: BulkImportConfig) {
  const vehicles: Array<{ year: number; make: string; model: string; tier: string }> = [];
  
  const tierMap = {
    tier1: TIER_1_VEHICLES,
    tier2: TIER_2_VEHICLES,
    tier3: TIER_3_VEHICLES,
  };

  for (const tier of config.tiers) {
    const tierVehicles = tierMap[tier];
    for (const vehicle of tierVehicles) {
      for (const year of config.years) {
        vehicles.push({
          year,
          make: vehicle.make,
          model: vehicle.model,
          tier,
        });
      }
    }
  }

  return vehicles;
}

/**
 * Get all target vehicles (all tiers)
 */
export function getAllTargetVehicles() {
  return [...TIER_1_VEHICLES, ...TIER_2_VEHICLES, ...TIER_3_VEHICLES];
}

/**
 * Count total vehicles across all tiers × years
 */
export function getTotalTargetCount() {
  const vehicleCount = TIER_1_VEHICLES.length + TIER_2_VEHICLES.length + TIER_3_VEHICLES.length;
  return vehicleCount * IMPORT_YEARS.length;
}

/**
 * Print summary of target vehicles
 */
export function printTargetSummary() {
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("BULK FITMENT IMPORT STRATEGY - Target Summary");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  console.log(`Tier 1 (High Volume):  ${TIER_1_VEHICLES.length} vehicles × ${IMPORT_YEARS.length} years = ${TIER_1_VEHICLES.length * IMPORT_YEARS.length} records`);
  console.log(`Tier 2 (Medium Volume): ${TIER_2_VEHICLES.length} vehicles × ${IMPORT_YEARS.length} years = ${TIER_2_VEHICLES.length * IMPORT_YEARS.length} records`);
  console.log(`Tier 3 (Additional):    ${TIER_3_VEHICLES.length} vehicles × ${IMPORT_YEARS.length} years = ${TIER_3_VEHICLES.length * IMPORT_YEARS.length} records`);
  console.log("─────────────────────────────────────────────────────────────────────────────────");
  console.log(`TOTAL:                  ${getTotalTargetCount()} records\n`);
  
  console.log("Years covered:", IMPORT_YEARS.join(", "));
  console.log("\nExpected coverage:");
  console.log("  - Tier 1 covers ~40% of US market search volume");
  console.log("  - Tier 1+2 covers ~75% of US market search volume");
  console.log("  - All tiers cover ~90% of US market search volume");
  console.log("\nExpected API reduction: 80-90% fewer Wheel-Size API calls");
}
