/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COVERAGE METRICS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Extended coverage reporting with:
 * - % coverage by top vehicles (weighted by volume)
 * - Search frequency integration (when available)
 * - Prioritized missing vehicle list
 * 
 * @created 2026-03-27
 */

import { db, schema } from "./db";
import { sql, desc } from "drizzle-orm";
import {
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
} from "./bulkImportStrategy";
import { normalizeMake, normalizeModel } from "./normalization";

// ═══════════════════════════════════════════════════════════════════════════════
// US SALES VOLUME DATA (2023 estimates for weighting)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Relative sales volume weights (1-100 scale)
 * Based on US market share estimates
 */
export const SALES_WEIGHTS: Record<string, Record<string, number>> = {
  "ford": {
    "f-150": 100,      // #1 selling vehicle
    "f-250": 40,
    "f-350": 25,
    "ranger": 30,
    "maverick": 25,
    "explorer": 50,
    "expedition": 25,
    "bronco": 35,
    "bronco-sport": 30,
    "escape": 40,
    "mustang": 25,
    "mustang-mach-e": 20,
  },
  "chevrolet": {
    "silverado-1500": 90, // #2 selling vehicle
    "silverado-2500hd": 30,
    "silverado-3500hd": 15,
    "colorado": 25,
    "tahoe": 40,
    "suburban": 25,
    "equinox": 50,
    "traverse": 35,
    "blazer": 25,
    "trailblazer": 20,
    "malibu": 30,
  },
  "ram": {
    "1500": 85,        // #3 selling vehicle
    "2500": 25,
    "3500": 15,
  },
  "toyota": {
    "rav4": 75,
    "camry": 55,
    "tacoma": 50,
    "highlander": 45,
    "corolla": 40,
    "tundra": 30,
    "4runner": 35,
    "sienna": 25,
  },
  "honda": {
    "cr-v": 60,
    "civic": 45,
    "accord": 40,
    "pilot": 35,
    "hr-v": 25,
  },
  "jeep": {
    "grand-cherokee": 55,
    "wrangler": 50,
    "cherokee": 25,
    "compass": 20,
    "gladiator": 25,
  },
  "gmc": {
    "sierra-1500": 55,
    "sierra-2500hd": 20,
    "yukon": 30,
    "acadia": 25,
    "terrain": 25,
  },
  "tesla": {
    "model-y": 70,
    "model-3": 50,
    "model-x": 15,
    "model-s": 10,
    "cybertruck": 20,
  },
  "hyundai": {
    "tucson": 40,
    "santa-fe": 30,
    "elantra": 30,
    "palisade": 25,
  },
  "kia": {
    "telluride": 35,
    "sportage": 30,
    "sorento": 25,
    "forte": 20,
  },
  "subaru": {
    "outback": 35,
    "forester": 30,
    "crosstrek": 35,
    "ascent": 20,
  },
};

/**
 * Get sales weight for a vehicle
 */
export function getSalesWeight(make: string, model: string): number {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(make, model);
  
  const makeWeights = SALES_WEIGHTS[normalizedMake];
  if (!makeWeights) return 10; // Default weight for unknown
  
  return makeWeights[normalizedModel] || 10;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENDED COVERAGE METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtendedCoverageStats {
  // Basic counts
  totalTargetVehicles: number;
  populatedVehicles: number;
  coveragePercent: number;
  
  // Weighted coverage
  weightedCoveragePercent: number;  // Weighted by sales volume
  estimatedSearchCoverage: number;  // % of actual searches covered
  
  // By tier
  byTier: {
    tier1: TierStats;
    tier2: TierStats;
    tier3: TierStats;
  };
  
  // By year
  byYear: Record<number, YearStats>;
  
  // Top missing vehicles (prioritized by weight)
  topMissing: MissingVehicle[];
  
  // Inheritance opportunities
  inheritanceOpportunities: InheritanceOpportunity[];
}

export interface TierStats {
  total: number;
  populated: number;
  percent: number;
  weight: number;
  weightedPercent: number;
}

export interface YearStats {
  total: number;
  populated: number;
  percent: number;
}

export interface MissingVehicle {
  make: string;
  model: string;
  years: number[];
  weight: number;
  priority: number;
  hasRelatedData: boolean;
}

export interface InheritanceOpportunity {
  make: string;
  model: string;
  sourceYear: number;
  targetYears: number[];
  potentialFill: number;
}

/**
 * Calculate extended coverage metrics
 */
export async function calculateExtendedCoverage(): Promise<ExtendedCoverageStats> {
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

  const populatedSet = new Set(
    populatedQuery.map(v => `${v.year}|${v.make.toLowerCase()}|${v.model.toLowerCase()}`)
  );
  
  // Also track which make/models have ANY data
  const modelCoverage = new Map<string, Set<number>>();
  for (const v of populatedQuery) {
    const key = `${v.make.toLowerCase()}|${v.model.toLowerCase()}`;
    if (!modelCoverage.has(key)) {
      modelCoverage.set(key, new Set());
    }
    modelCoverage.get(key)!.add(v.year);
  }

  const tiers = [
    { name: "tier1", vehicles: TIER_1_VEHICLES, tierWeight: 0.40 },
    { name: "tier2", vehicles: TIER_2_VEHICLES, tierWeight: 0.35 },
    { name: "tier3", vehicles: TIER_3_VEHICLES, tierWeight: 0.15 },
  ];

  const byTier: ExtendedCoverageStats["byTier"] = {
    tier1: { total: 0, populated: 0, percent: 0, weight: 0, weightedPercent: 0 },
    tier2: { total: 0, populated: 0, percent: 0, weight: 0, weightedPercent: 0 },
    tier3: { total: 0, populated: 0, percent: 0, weight: 0, weightedPercent: 0 },
  };

  const byYear: ExtendedCoverageStats["byYear"] = {};
  const missingByModel = new Map<string, { make: string; model: string; years: number[]; weight: number }>();
  const inheritanceOps: InheritanceOpportunity[] = [];

  let totalTarget = 0;
  let totalPopulated = 0;
  let totalWeight = 0;
  let populatedWeight = 0;

  for (const tier of tiers) {
    const tierKey = tier.name as keyof typeof byTier;
    let tierTotal = 0;
    let tierPopulated = 0;
    let tierWeight = 0;
    let tierPopulatedWeight = 0;

    for (const vehicle of tier.vehicles) {
      const weight = getSalesWeight(vehicle.make, vehicle.model);
      const modelKey = `${normalizeMake(vehicle.make)}|${normalizeModel(vehicle.make, vehicle.model)}`;
      const existingYears = modelCoverage.get(modelKey) || new Set();
      
      const missingYears: number[] = [];
      
      for (const year of IMPORT_YEARS) {
        const key = `${year}|${normalizeMake(vehicle.make)}|${normalizeModel(vehicle.make, vehicle.model)}`;
        tierTotal++;
        totalTarget++;
        tierWeight += weight;
        totalWeight += weight;

        if (!byYear[year]) {
          byYear[year] = { total: 0, populated: 0, percent: 0 };
        }
        byYear[year].total++;

        if (populatedSet.has(key)) {
          tierPopulated++;
          totalPopulated++;
          tierPopulatedWeight += weight;
          populatedWeight += weight;
          byYear[year].populated++;
        } else {
          missingYears.push(year);
        }
      }
      
      // Track missing vehicles
      if (missingYears.length > 0) {
        const existingKey = `${vehicle.make}|${vehicle.model}`;
        if (!missingByModel.has(existingKey)) {
          missingByModel.set(existingKey, {
            make: vehicle.make,
            model: vehicle.model,
            years: missingYears,
            weight,
          });
        } else {
          missingByModel.get(existingKey)!.years.push(...missingYears);
        }
      }
      
      // Check for inheritance opportunities
      if (existingYears.size > 0 && missingYears.length > 0) {
        const sourceYear = Math.max(...Array.from(existingYears));
        inheritanceOps.push({
          make: vehicle.make,
          model: vehicle.model,
          sourceYear,
          targetYears: missingYears,
          potentialFill: missingYears.length,
        });
      }
    }

    byTier[tierKey] = {
      total: tierTotal,
      populated: tierPopulated,
      percent: tierTotal > 0 ? Math.round((tierPopulated / tierTotal) * 100) : 0,
      weight: tierWeight,
      weightedPercent: tierWeight > 0 ? Math.round((tierPopulatedWeight / tierWeight) * 100) : 0,
    };
  }

  // Calculate year percentages
  for (const year of Object.keys(byYear)) {
    const y = byYear[Number(year)];
    y.percent = y.total > 0 ? Math.round((y.populated / y.total) * 100) : 0;
  }

  const coveragePercent = totalTarget > 0 ? Math.round((totalPopulated / totalTarget) * 100) : 0;
  const weightedCoveragePercent = totalWeight > 0 ? Math.round((populatedWeight / totalWeight) * 100) : 0;

  // Estimate search coverage (weighted by tier + volume)
  const estimatedSearchCoverage = Math.round(
    byTier.tier1.weightedPercent * 0.40 +
    byTier.tier2.weightedPercent * 0.35 +
    byTier.tier3.weightedPercent * 0.15 +
    10 * 0.10 // Assume 10% baseline for long-tail
  );

  // Build prioritized missing list
  const topMissing: MissingVehicle[] = Array.from(missingByModel.values())
    .map(m => ({
      make: m.make,
      model: m.model,
      years: [...new Set(m.years)].sort((a, b) => b - a),
      weight: m.weight,
      priority: m.weight * (m.years.length > 5 ? 1.5 : 1),
      hasRelatedData: modelCoverage.has(`${normalizeMake(m.make)}|${normalizeModel(m.make, m.model)}`),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 50);

  // Sort inheritance opportunities by potential impact
  const sortedInheritance = inheritanceOps
    .sort((a, b) => {
      const aWeight = getSalesWeight(a.make, a.model) * a.potentialFill;
      const bWeight = getSalesWeight(b.make, b.model) * b.potentialFill;
      return bWeight - aWeight;
    })
    .slice(0, 20);

  return {
    totalTargetVehicles: totalTarget,
    populatedVehicles: totalPopulated,
    coveragePercent,
    weightedCoveragePercent,
    estimatedSearchCoverage,
    byTier,
    byYear,
    topMissing,
    inheritanceOpportunities: sortedInheritance,
  };
}

/**
 * Print extended coverage report
 */
export async function printExtendedCoverageReport(): Promise<void> {
  const stats = await calculateExtendedCoverage();
  
  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("EXTENDED COVERAGE REPORT");
  console.log("═══════════════════════════════════════════════════════════════════════════════\n");
  
  console.log("📊 OVERALL COVERAGE\n");
  console.log(`  Target vehicles:      ${stats.totalTargetVehicles}`);
  console.log(`  Populated:            ${stats.populatedVehicles}`);
  console.log(`  Raw coverage:         ${stats.coveragePercent}%`);
  console.log(`  Weighted coverage:    ${stats.weightedCoveragePercent}% (by sales volume)`);
  console.log(`  Est. search coverage: ${stats.estimatedSearchCoverage}%`);
  
  console.log("\n📈 BY TIER (weighted by sales volume)\n");
  console.log(`  Tier 1: ${stats.byTier.tier1.populated}/${stats.byTier.tier1.total} (${stats.byTier.tier1.percent}% raw, ${stats.byTier.tier1.weightedPercent}% weighted)`);
  console.log(`  Tier 2: ${stats.byTier.tier2.populated}/${stats.byTier.tier2.total} (${stats.byTier.tier2.percent}% raw, ${stats.byTier.tier2.weightedPercent}% weighted)`);
  console.log(`  Tier 3: ${stats.byTier.tier3.populated}/${stats.byTier.tier3.total} (${stats.byTier.tier3.percent}% raw, ${stats.byTier.tier3.weightedPercent}% weighted)`);
  
  console.log("\n🔥 TOP MISSING VEHICLES (by priority)\n");
  for (const m of stats.topMissing.slice(0, 15)) {
    const inheritance = m.hasRelatedData ? " [can inherit]" : "";
    console.log(`  ${m.make} ${m.model} (weight: ${m.weight}) - missing ${m.years.length} years${inheritance}`);
  }
  
  console.log("\n🔄 INHERITANCE OPPORTUNITIES\n");
  for (const op of stats.inheritanceOpportunities.slice(0, 10)) {
    console.log(`  ${op.make} ${op.model}: copy ${op.sourceYear} → ${op.targetYears.length} years`);
  }
  
  console.log("");
}
