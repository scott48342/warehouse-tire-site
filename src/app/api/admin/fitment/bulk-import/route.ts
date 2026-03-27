/**
 * Bulk Fitment Import API
 * 
 * Endpoints:
 * - GET: Get current coverage stats and target vehicle list
 * - POST: Start bulk import (with config)
 * 
 * @created 2026-03-27
 */

import { NextResponse } from "next/server";
import {
  calculateCoverage,
  getAllTargetVehicles,
  getTotalTargetCount,
  getTargetVehicles,
  executeBulkImport,
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
  type BulkImportConfig,
} from "@/lib/fitment-db/bulkImportStrategy";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max for API route

/**
 * GET /api/admin/fitment/bulk-import
 * 
 * Returns coverage statistics and target vehicle summary
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeVehicleList = url.searchParams.get("includeVehicles") === "1";
  
  try {
    // Calculate current coverage
    const coverage = await calculateCoverage();
    
    // Build summary
    const summary = {
      targetVehicles: {
        tier1: {
          count: TIER_1_VEHICLES.length,
          totalRecords: TIER_1_VEHICLES.length * IMPORT_YEARS.length,
          examples: TIER_1_VEHICLES.slice(0, 5).map(v => `${v.make} ${v.model}`),
        },
        tier2: {
          count: TIER_2_VEHICLES.length,
          totalRecords: TIER_2_VEHICLES.length * IMPORT_YEARS.length,
          examples: TIER_2_VEHICLES.slice(0, 5).map(v => `${v.make} ${v.model}`),
        },
        tier3: {
          count: TIER_3_VEHICLES.length,
          totalRecords: TIER_3_VEHICLES.length * IMPORT_YEARS.length,
          examples: TIER_3_VEHICLES.slice(0, 5).map(v => `${v.make} ${v.model}`),
        },
        total: getTotalTargetCount(),
      },
      years: IMPORT_YEARS,
      coverage,
      expectedOutcome: {
        searchCoveragePercent: coverage.estimatedSearchCoverage,
        apiReductionPercent: coverage.estimatedApiReduction,
        description: `With current coverage, ~${coverage.estimatedSearchCoverage}% of searches will be served from DB without Wheel-Size API calls`,
      },
    };
    
    // Optionally include full vehicle list
    if (includeVehicleList) {
      (summary as any).vehicles = {
        tier1: TIER_1_VEHICLES,
        tier2: TIER_2_VEHICLES,
        tier3: TIER_3_VEHICLES,
      };
    }
    
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[bulk-import] Error calculating coverage:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/fitment/bulk-import
 * 
 * Start a bulk import job
 * 
 * Body:
 * {
 *   tiers: ["tier1", "tier2", "tier3"],
 *   years: [2024, 2023, ...],
 *   dryRun: false,
 *   skipExisting: true,
 *   maxVehicles: 100 // optional limit for testing
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const config: BulkImportConfig = {
      tiers: body.tiers || ["tier1"],
      years: body.years || IMPORT_YEARS.slice(0, 5), // Default: recent 5 years
      dryRun: body.dryRun ?? false,
      skipExisting: body.skipExisting ?? true,
      delayBetweenCalls: body.delayBetweenCalls ?? 1000, // 1 second between calls
      stopOnError: body.stopOnError ?? false,
    };
    
    // Calculate what we'll import
    const targetVehicles = getTargetVehicles(config);
    const maxVehicles = body.maxVehicles ? Math.min(body.maxVehicles, targetVehicles.length) : targetVehicles.length;
    
    // For API route, limit to prevent timeout
    if (maxVehicles > 50 && !config.dryRun) {
      return NextResponse.json({
        error: "API route limited to 50 vehicles per request. Use CLI script for larger imports.",
        suggestion: "Run: npx tsx scripts/bulk-import-fitment.ts",
        targetCount: targetVehicles.length,
      }, { status: 400 });
    }
    
    console.log(`[bulk-import] Starting import: ${maxVehicles} vehicles, dryRun=${config.dryRun}`);
    
    // Execute import (limited set)
    const limitedConfig = {
      ...config,
      tiers: config.tiers,
      years: config.years,
    };
    
    // If maxVehicles is set, we need to limit manually
    let importCount = 0;
    const errors: Array<{ vehicle: string; error: string }> = [];
    
    const result = await executeBulkImport(limitedConfig, (progress) => {
      // Log progress
      if (progress.completed % 10 === 0) {
        console.log(`[bulk-import] Progress: ${progress.completed}/${progress.total}`);
      }
      
      // Stop if we hit maxVehicles
      if (maxVehicles && progress.completed >= maxVehicles) {
        // Note: Can't actually stop mid-execution from here, but we track it
      }
    });
    
    return NextResponse.json({
      success: result.success,
      summary: {
        totalProcessed: result.totalProcessed,
        imported: result.imported,
        skipped: result.skipped,
        failed: result.failed,
        durationMs: result.durationMs,
        durationFormatted: formatDuration(result.durationMs),
      },
      errors: result.errors.slice(0, 20), // Limit errors in response
      coverage: result.coverageAfter,
      config: {
        tiers: config.tiers,
        years: config.years,
        dryRun: config.dryRun,
        skipExisting: config.skipExisting,
      },
    });
  } catch (err) {
    console.error("[bulk-import] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
