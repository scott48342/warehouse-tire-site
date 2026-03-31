/**
 * SEO Fitment Data Fetcher
 * 
 * Fetches fitment facts from DB for SEO page content
 */

import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { FitmentFacts, ResolvedVehicle, VehicleParams, TopVehicle } from "./types";
import { toSlug, getMakeDisplay, getModelDisplay } from "./slugs";

// ============================================================================
// Vehicle Resolution
// ============================================================================

/**
 * Resolve URL params to a normalized vehicle object
 */
export function resolveVehicle(params: VehicleParams): ResolvedVehicle {
  const year = parseInt(params.year, 10);
  const make = params.make.toLowerCase();
  const model = params.model.toLowerCase();
  const trim = params.trim?.[0] || null;
  
  return {
    year,
    make,
    model,
    trim,
    displayMake: getMakeDisplay(make),
    displayModel: getModelDisplay(model),
    displayTrim: trim ? getModelDisplay(trim) : null,
  };
}

/**
 * Check if a vehicle has valid year
 */
export function isValidYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return year >= 1990 && year <= currentYear + 2;
}

// ============================================================================
// Fitment Data Fetching
// ============================================================================

/**
 * Fetch fitment facts for a vehicle from the database
 */
export async function getFitmentFacts(
  vehicle: ResolvedVehicle
): Promise<FitmentFacts | null> {
  try {
    // Query for fitment data
    const fitments = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, vehicle.year),
          eq(vehicleFitments.make, vehicle.make),
          eq(vehicleFitments.model, vehicle.model)
        )
      )
      .limit(10);
    
    if (fitments.length === 0) {
      return null;
    }
    
    // If trim specified, try to find exact match
    let bestFitment = fitments[0];
    if (vehicle.trim) {
      const trimMatch = fitments.find(
        f => toSlug(f.displayTrim || "") === vehicle.trim ||
             toSlug(f.rawTrim || "") === vehicle.trim
      );
      if (trimMatch) {
        bestFitment = trimMatch;
      }
    }
    
    // Aggregate OEM wheel sizes and tire sizes across all trims
    const allWheelDiameters = new Set<number>();
    const allTireSizes = new Set<string>();
    let hasStaggered = false;
    
    for (const f of fitments) {
      if (Array.isArray(f.oemWheelSizes)) {
        for (const ws of f.oemWheelSizes as any[]) {
          if (ws.diameter) allWheelDiameters.add(Number(ws.diameter));
          if (ws.axle === "front" || ws.axle === "rear") hasStaggered = true;
        }
      }
      if (Array.isArray(f.oemTireSizes)) {
        for (const ts of f.oemTireSizes as string[]) {
          allTireSizes.add(ts);
        }
      }
    }
    
    return {
      boltPattern: bestFitment.boltPattern,
      centerBoreMm: bestFitment.centerBoreMm ? Number(bestFitment.centerBoreMm) : null,
      threadSize: bestFitment.threadSize,
      seatType: bestFitment.seatType,
      offsetRange: bestFitment.offsetMinMm && bestFitment.offsetMaxMm
        ? { min: Number(bestFitment.offsetMinMm), max: Number(bestFitment.offsetMaxMm) }
        : null,
      oemWheelDiameters: [...allWheelDiameters].sort((a, b) => a - b),
      oemTireSizes: [...allTireSizes].slice(0, 10), // Limit for display
      hasStaggered,
    };
  } catch (err) {
    console.error("[seo/fitment] Error fetching fitment:", err);
    return null;
  }
}

// ============================================================================
// Top Vehicles for Static Generation
// ============================================================================

/**
 * Get top vehicles for static generation
 * Returns vehicles with the most fitment data / highest search volume proxies
 */
export async function getTopVehicles(limit: number = 200): Promise<TopVehicle[]> {
  try {
    // Get vehicles with most fitment records (proxy for popularity)
    const results = await db.execute(sql`
      SELECT 
        year, 
        make, 
        model, 
        COUNT(*) as trim_count
      FROM vehicle_fitments
      WHERE year >= 2020
      GROUP BY year, make, model
      ORDER BY trim_count DESC, year DESC
      LIMIT ${limit}
    `);
    
    const vehicles: TopVehicle[] = (results.rows as any[]).map((row, idx) => ({
      year: row.year,
      make: row.make,
      model: row.model,
      // Priority decays with rank
      priority: Math.max(0.3, 1 - (idx / limit) * 0.7),
    }));
    
    // Add some known high-value vehicles that might not have many trims
    const mustHaves = [
      { year: 2024, make: "ford", model: "f-150" },
      { year: 2024, make: "chevrolet", model: "silverado-1500" },
      { year: 2024, make: "ram", model: "1500" },
      { year: 2024, make: "toyota", model: "camry" },
      { year: 2024, make: "toyota", model: "rav4" },
      { year: 2024, make: "honda", model: "accord" },
      { year: 2024, make: "honda", model: "cr-v" },
      { year: 2024, make: "tesla", model: "model-y" },
      { year: 2024, make: "tesla", model: "model-3" },
      { year: 2024, make: "jeep", model: "wrangler" },
      { year: 2024, make: "jeep", model: "grand-cherokee" },
    ];
    
    for (const v of mustHaves) {
      if (!vehicles.find(x => x.year === v.year && x.make === v.make && x.model === v.model)) {
        vehicles.push({ ...v, priority: 0.9 });
      }
    }
    
    return vehicles;
  } catch (err) {
    console.error("[seo/fitment] Error getting top vehicles:", err);
    return [];
  }
}

/**
 * Get all unique makes from the database
 */
export async function getAllMakes(): Promise<string[]> {
  try {
    const results = await db.execute(sql`
      SELECT DISTINCT make FROM vehicle_fitments ORDER BY make
    `);
    return (results.rows as any[]).map(r => r.make);
  } catch (err) {
    console.error("[seo/fitment] Error getting makes:", err);
    return [];
  }
}

/**
 * Get all models for a make
 */
export async function getModelsForMake(make: string): Promise<string[]> {
  try {
    const results = await db.execute(sql`
      SELECT DISTINCT model FROM vehicle_fitments 
      WHERE make = ${make.toLowerCase()}
      ORDER BY model
    `);
    return (results.rows as any[]).map(r => r.model);
  } catch (err) {
    console.error("[seo/fitment] Error getting models:", err);
    return [];
  }
}
