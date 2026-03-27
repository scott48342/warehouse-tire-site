/**
 * Bulk Fitment Import API
 * 
 * Runs on deployed server which has WHEELSIZE_API_KEY.
 * 
 * GET  - Get coverage stats
 * POST - Run import (with limits for safety)
 * 
 * @created 2026-03-27
 */

import { NextResponse } from "next/server";
import {
  calculateCoverage,
  getTargetVehicles,
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
} from "@/lib/fitment-db/bulkImportStrategy";
import { importVehicleFitment } from "@/lib/fitmentImport";
import { db } from "@/lib/fitment-db/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

/**
 * GET /api/admin/fitment/bulk-import
 * Returns coverage statistics
 */
export async function GET() {
  try {
    const coverage = await calculateCoverage();
    
    return NextResponse.json({
      coverage,
      targets: {
        tier1: { count: TIER_1_VEHICLES.length, examples: TIER_1_VEHICLES.slice(0, 5) },
        tier2: { count: TIER_2_VEHICLES.length, examples: TIER_2_VEHICLES.slice(0, 5) },
        tier3: { count: TIER_3_VEHICLES.length, examples: TIER_3_VEHICLES.slice(0, 5) },
        years: IMPORT_YEARS,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

async function checkVehicleExists(year: number, make: string, model: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM vehicle_fitments 
      WHERE year = ${year} 
        AND LOWER(make) = LOWER(${make})
        AND LOWER(model) = LOWER(${model})
      LIMIT 1
    `);
    return (result.rows?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/fitment/bulk-import
 * 
 * Body:
 * {
 *   tiers: ["tier1"],           // which tiers to import
 *   years: [2024, 2023],        // which years
 *   limit: 10,                  // max vehicles (safety limit)
 *   skipExisting: true,         // skip if already in DB
 *   delayMs: 500                // delay between API calls
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const tiers = body.tiers || ["tier1"];
    const years = body.years || [2024];
    const limit = Math.min(body.limit || 10, 50); // Max 50 per request for safety
    const skipExisting = body.skipExisting !== false;
    const delayMs = body.delayMs || 500;
    
    // Get target vehicles
    const allTargets = getTargetVehicles({ tiers, years });
    const targets = allTargets.slice(0, limit);
    
    console.log(`[bulk-import] Starting import: ${targets.length} vehicles`);
    
    const results: Array<{
      vehicle: string;
      status: "success" | "skipped" | "failed";
      wheelSpecs?: number;
      error?: string;
    }> = [];
    
    let success = 0;
    let skipped = 0;
    let failed = 0;
    
    for (let i = 0; i < targets.length; i++) {
      const v = targets[i];
      const vehicleLabel = `${v.year} ${v.make} ${v.model}`;
      
      // Check if exists
      if (skipExisting) {
        const exists = await checkVehicleExists(v.year, v.make, v.model);
        if (exists) {
          results.push({ vehicle: vehicleLabel, status: "skipped" });
          skipped++;
          continue;
        }
      }
      
      // Import
      try {
        const result = await importVehicleFitment(v.year, v.make, v.model, {
          usMarketOnly: true,
          debug: false,
        });
        
        if (result.success) {
          results.push({ 
            vehicle: vehicleLabel, 
            status: "success",
            wheelSpecs: result.wheelSpecsCount,
          });
          success++;
        } else {
          results.push({ 
            vehicle: vehicleLabel, 
            status: "failed",
            error: result.error || "Unknown error",
          });
          failed++;
        }
      } catch (err) {
        results.push({ 
          vehicle: vehicleLabel, 
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
      
      // Rate limiting (except for last item)
      if (i < targets.length - 1 && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Get updated coverage
    const coverage = await calculateCoverage();
    
    return NextResponse.json({
      summary: {
        processed: targets.length,
        success,
        skipped,
        failed,
      },
      results,
      coverage,
    });
  } catch (err) {
    console.error("[bulk-import] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
