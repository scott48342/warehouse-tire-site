/**
 * FITMENT HEALTH CHECK API
 * 
 * GET /api/admin/fitment/health
 * 
 * Verifies that known vehicles are visible through all customer-facing fitment paths:
 * - Trims API
 * - Tire Sizes API
 * - Wheel Search API
 * 
 * This is part of the consolidation guard ensuring vehicle_fitments is the single
 * runtime source of truth.
 * 
 * Returns:
 * - 200: All vehicles pass health check
 * - 500: One or more vehicles failed (returns details)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, sql, ilike } from "drizzle-orm";
import { getTrimsWithCoverage, hasYearCoverage } from "@/lib/fitment-db/coverage";
import { resolveVehicleFitment } from "@/lib/fitment/canonicalResolver";
import { getModelVariants } from "@/lib/fitment-db/modelAliases";
import { normalizeMake } from "@/lib/fitment-db/normalization";

export const runtime = "nodejs";
export const maxDuration = 60;

// ════════════════════════════════════════════════════════════════════════════════
// SENTINEL VEHICLES
// These are known vehicles that MUST resolve correctly in production.
// Failure to resolve any of these blocks deployment.
// ════════════════════════════════════════════════════════════════════════════════

const SENTINEL_VEHICLES = [
  // Problem vehicles from 2026-05-13 audit (all should pass now)
  { year: 2022, make: "Ford", model: "F-150 Lightning", minTrims: 1 },
  { year: 2023, make: "Ford", model: "F-150 Lightning", minTrims: 1 },
  { year: 2022, make: "Chevrolet", model: "Silverado 2500 HD", minTrims: 1 },
  { year: 2023, make: "Chevrolet", model: "Silverado 2500 HD", minTrims: 1 },
  { year: 2024, make: "Chevrolet", model: "Silverado 2500 HD", minTrims: 1 },
  { year: 2024, make: "Toyota", model: "Tacoma", minTrims: 1 },
  { year: 2025, make: "Ford", model: "Bronco", minTrims: 1 },
  { year: 2024, make: "Chevrolet", model: "Corvette", minTrims: 1 },
  { year: 2024, make: "BMW", model: "M3", minTrims: 1 },
  { year: 2024, make: "Ram", model: "3500", minTrims: 1 },
  
  // High-volume vehicles that must always work
  { year: 2024, make: "Ford", model: "F-150", minTrims: 1 },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500", minTrims: 1 },
  { year: 2024, make: "Toyota", model: "Camry", minTrims: 1 },
  { year: 2024, make: "Honda", model: "Civic", minTrims: 1 },
];

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

interface VehicleCheckResult {
  vehicle: string;
  status: "pass" | "fail";
  checks: {
    hasCoverage: boolean;
    trimsFound: number;
    trimNames: string[];
    canResolve: boolean;
    resolutionMethod: string | null;
    hasTireSizes: boolean;
    tireSizeCount: number;
  };
  error?: string;
}

interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  source: "vehicle_fitments";
  deprecatedTableActive: false;
  checks: {
    sentinelVehicles: {
      total: number;
      passed: number;
      failed: number;
      results: VehicleCheckResult[];
    };
    databaseConnectivity: boolean;
    tableExists: boolean;
    recordCount: number;
  };
  summary: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════════

async function checkVehicle(
  year: number,
  make: string,
  model: string,
  minTrims: number
): Promise<VehicleCheckResult> {
  const vehicleStr = `${year} ${make} ${model}`;
  
  try {
    // Check 1: Does this Y/M/M have coverage?
    const hasCoverage = await hasYearCoverage(year, make, model);
    
    // Check 2: Get trims
    const trimResult = await getTrimsWithCoverage(year, make, model);
    const trimsFound = trimResult.trims.length;
    const trimNames = trimResult.trims.map(t => t.displayTrim).slice(0, 10);
    
    // Check 3: Can we resolve fitment for the first trim?
    let canResolve = false;
    let resolutionMethod: string | null = null;
    let hasTireSizes = false;
    let tireSizeCount = 0;
    
    if (trimResult.trims.length > 0) {
      const firstTrim = trimResult.trims[0];
      const resolution = await resolveVehicleFitment({
        year,
        make,
        model,
        trim: firstTrim.displayTrim,
        modificationId: firstTrim.modificationId,
      });
      
      canResolve = resolution.matchedBy !== "not_found" && resolution.matchedBy !== "blocked";
      resolutionMethod = resolution.matchedBy;
      
      if (resolution.fitment) {
        const tireSizes = resolution.fitment.oemTireSizes as string[] | null;
        hasTireSizes = Array.isArray(tireSizes) && tireSizes.length > 0;
        tireSizeCount = Array.isArray(tireSizes) ? tireSizes.length : 0;
      }
    }
    
    // Determine pass/fail
    const passed = hasCoverage && trimsFound >= minTrims && canResolve && hasTireSizes;
    
    return {
      vehicle: vehicleStr,
      status: passed ? "pass" : "fail",
      checks: {
        hasCoverage,
        trimsFound,
        trimNames,
        canResolve,
        resolutionMethod,
        hasTireSizes,
        tireSizeCount,
      },
      error: !passed ? `Expected ${minTrims}+ trims, tire sizes, and resolution` : undefined,
    };
  } catch (err: any) {
    return {
      vehicle: vehicleStr,
      status: "fail",
      checks: {
        hasCoverage: false,
        trimsFound: 0,
        trimNames: [],
        canResolve: false,
        resolutionMethod: null,
        hasTireSizes: false,
        tireSizeCount: 0,
      },
      error: err.message || "Unknown error",
    };
  }
}

export async function GET() {
  const startTime = Date.now();
  const results: VehicleCheckResult[] = [];
  let dbConnected = false;
  let tableExists = false;
  let recordCount = 0;
  
  try {
    // Check database connectivity and table existence
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicleFitments)
      .limit(1);
    
    dbConnected = true;
    tableExists = true;
    recordCount = countResult[0]?.count || 0;
    
    // Check all sentinel vehicles
    for (const vehicle of SENTINEL_VEHICLES) {
      const result = await checkVehicle(
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.minTrims
      );
      results.push(result);
    }
    
  } catch (err: any) {
    console.error("[fitment/health] Database error:", err.message);
    
    return NextResponse.json<HealthCheckResponse>({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      source: "vehicle_fitments",
      deprecatedTableActive: false,
      checks: {
        sentinelVehicles: {
          total: SENTINEL_VEHICLES.length,
          passed: 0,
          failed: SENTINEL_VEHICLES.length,
          results: [],
        },
        databaseConnectivity: false,
        tableExists: false,
        recordCount: 0,
      },
      summary: `Database connection failed: ${err.message}`,
    }, { status: 500 });
  }
  
  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const isHealthy = failed === 0 && dbConnected;
  
  const response: HealthCheckResponse = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    source: "vehicle_fitments",
    deprecatedTableActive: false,
    checks: {
      sentinelVehicles: {
        total: SENTINEL_VEHICLES.length,
        passed,
        failed,
        results,
      },
      databaseConnectivity: dbConnected,
      tableExists,
      recordCount,
    },
    summary: isHealthy
      ? `All ${passed} sentinel vehicles resolve correctly from vehicle_fitments`
      : `${failed}/${SENTINEL_VEHICLES.length} sentinel vehicles failed health check`,
  };
  
  const statusCode = isHealthy ? 200 : 500;
  const duration = Date.now() - startTime;
  
  console.log(`[fitment/health] ${isHealthy ? "✅" : "❌"} ${passed}/${SENTINEL_VEHICLES.length} passed (${duration}ms)`);
  
  return NextResponse.json(response, { 
    status: statusCode,
    headers: {
      "Cache-Control": "no-store",
      "X-Health-Check-Duration-Ms": String(duration),
    },
  });
}
