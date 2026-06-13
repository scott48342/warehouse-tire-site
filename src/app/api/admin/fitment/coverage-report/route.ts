/**
 * Coverage Report API for Universal Fitment Resolver
 * 
 * Runs a comprehensive test of the resolver against all vehicles in the DB
 * and produces statistics on resolution success rate.
 * 
 * GET /api/admin/fitment/coverage-report
 *   ?limit=100  - Max vehicles to test (default: all)
 *   ?sample=true - Random sample instead of sequential
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { sql, eq } from "drizzle-orm";
import { resolveUniversalFitment } from "@/lib/fitment/universalFitmentResolver";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

interface VehicleTestCase {
  year: number;
  make: string;
  model: string;
  trim: string | null;
}

interface TestResult {
  input: VehicleTestCase;
  resolved: boolean;
  matchedModel: string | null;
  matchedVariant: string | null;
  usedAlias: boolean;
  confidence: string;
  source: string;
  timeMs: number;
  error?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const sampleMode = searchParams.get("sample") === "true";
  const limit = limitParam ? parseInt(limitParam, 10) : null;
  
  console.log(`[coverage-report] Starting coverage report...`);
  
  try {
    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Get total vehicle count in DB
    // ─────────────────────────────────────────────────────────────────────
    const [{ count: totalVehicles }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicleFitments)
      .where(eq(vehicleFitments.certificationStatus, "certified"));
    
    // Get distinct YMM combinations
    const distinctVehicles = await db
      .selectDistinct({
        year: vehicleFitments.year,
        make: vehicleFitments.make,
        model: vehicleFitments.model,
      })
      .from(vehicleFitments)
      .where(eq(vehicleFitments.certificationStatus, "certified"))
      .orderBy(vehicleFitments.year, vehicleFitments.make, vehicleFitments.model);
    
    const totalDistinctYMM = distinctVehicles.length;
    
    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Build test cases
    // ─────────────────────────────────────────────────────────────────────
    let testCases: VehicleTestCase[] = distinctVehicles.map(v => ({
      year: v.year,
      make: v.make,
      model: v.model,
      trim: null, // Test base resolution first
    }));
    
    // Apply sampling if requested
    if (sampleMode && limit && limit < testCases.length) {
      const shuffled = [...testCases].sort(() => Math.random() - 0.5);
      testCases = shuffled.slice(0, limit);
    } else if (limit && limit < testCases.length) {
      testCases = testCases.slice(0, limit);
    }
    
    console.log(`[coverage-report] Testing ${testCases.length} of ${totalDistinctYMM} distinct vehicles`);
    
    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Run resolver on each test case
    // ─────────────────────────────────────────────────────────────────────
    const results: TestResult[] = [];
    const failures: TestResult[] = [];
    const aliasHits: TestResult[] = [];
    
    let resolved = 0;
    let failed = 0;
    let aliasUsed = 0;
    let highConfidence = 0;
    let mediumConfidence = 0;
    let lowConfidence = 0;
    
    const startTime = Date.now();
    
    for (const tc of testCases) {
      const t0 = Date.now();
      
      try {
        const result = await resolveUniversalFitment({
          year: tc.year,
          make: tc.make,
          model: tc.model,
          trim: tc.trim,
        });
        
        const testResult: TestResult = {
          input: tc,
          resolved: result.found,
          matchedModel: result.found ? result.model : null,
          matchedVariant: result.normalized.matchedVariant,
          usedAlias: result.normalized.modelVariantsTried.length > 1 && 
                     result.normalized.matchedVariant !== tc.model,
          confidence: result.confidence,
          source: result.source,
          timeMs: Date.now() - t0,
        };
        
        results.push(testResult);
        
        if (result.found) {
          resolved++;
          
          if (testResult.usedAlias) {
            aliasUsed++;
            aliasHits.push(testResult);
          }
          
          switch (result.confidence) {
            case "high": highConfidence++; break;
            case "medium": mediumConfidence++; break;
            case "low": lowConfidence++; break;
          }
        } else {
          failed++;
          failures.push(testResult);
        }
        
      } catch (err: any) {
        const testResult: TestResult = {
          input: tc,
          resolved: false,
          matchedModel: null,
          matchedVariant: null,
          usedAlias: false,
          confidence: "none",
          source: "error",
          timeMs: Date.now() - t0,
          error: err.message || String(err),
        };
        results.push(testResult);
        failures.push(testResult);
        failed++;
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Build report
    // ─────────────────────────────────────────────────────────────────────
    const report = {
      generatedAt: new Date().toISOString(),
      executionTimeMs: totalTime,
      
      database: {
        totalFitmentRecords: totalVehicles,
        distinctYMMCombinations: totalDistinctYMM,
      },
      
      tested: {
        total: testCases.length,
        sampleMode,
      },
      
      resolution: {
        resolved,
        failed,
        successRate: ((resolved / testCases.length) * 100).toFixed(2) + "%",
      },
      
      aliasMapping: {
        vehiclesRequiringAlias: aliasUsed,
        aliasRate: ((aliasUsed / resolved) * 100).toFixed(2) + "%",
      },
      
      confidence: {
        high: highConfidence,
        medium: mediumConfidence,
        low: lowConfidence,
        highRate: resolved > 0 ? ((highConfidence / resolved) * 100).toFixed(2) + "%" : "0%",
      },
      
      performance: {
        avgResolutionTimeMs: (totalTime / testCases.length).toFixed(2),
        totalTimeMs: totalTime,
      },
      
      // Include sample failures for debugging
      sampleFailures: failures.slice(0, 20).map(f => ({
        vehicle: `${f.input.year} ${f.input.make} ${f.input.model}`,
        error: f.error || "No match found",
      })),
      
      // Include sample alias mappings for verification
      sampleAliasHits: aliasHits.slice(0, 20).map(a => ({
        input: `${a.input.year} ${a.input.make} ${a.input.model}`,
        matchedAs: a.matchedModel,
        matchedVariant: a.matchedVariant,
      })),
    };
    
    console.log(`[coverage-report] Complete: ${resolved}/${testCases.length} resolved (${report.resolution.successRate})`);
    
    return NextResponse.json(report);
    
  } catch (err: any) {
    console.error(`[coverage-report] Error:`, err);
    return NextResponse.json(
      { error: err.message || "Coverage report failed" },
      { status: 500 }
    );
  }
}
