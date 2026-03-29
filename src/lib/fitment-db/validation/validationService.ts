/**
 * Validation Service
 * 
 * Runs production fitment flow validation against real APIs
 * Tests: vehicle -> tire sizes -> wheels -> tires -> packages
 */

import { db } from "../db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { vehicleFitments } from "../schema";
import {
  validationRuns,
  validationResults,
  type ValidationRun,
  type ValidationResult,
  type NewValidationResult,
} from "./schema";
import { getLiftRecommendation } from "@/lib/liftedRecommendations";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shop.warehousetiredirect.com";

// ============================================================================
// Types
// ============================================================================

export interface ValidationRunConfig {
  name: string;
  description?: string;
  filterYear?: number;
  filterMake?: string;
  filterModel?: string;
  filterBoltPattern?: string;
  includeLifted?: boolean;
  limit?: number;
  createdBy?: string;
}

export interface VehicleToTest {
  year: number;
  make: string;
  model: string;
  trim?: string;
  modificationId?: string;
  boltPattern?: string;
}

interface FlowResult {
  tireSizes: string[];
  tireSizeSource?: string;
  boltPattern?: string;
  wheelCount: number;
  tireCount: number;
  packageCount: number;
  errors: string[];
  timings: Record<string, number>;
}

interface LiftedFlowResult extends FlowResult {
  presetId: string;
  liftInches: number;
}

interface StaggeredFlowResult {
  applicable: boolean;
  status: "pass" | "fail" | "skipped";
  frontTireSize?: string;
  rearTireSize?: string;
  frontTireCount: number;
  rearTireCount: number;
  wheelCount: number;
  packageCount: number;
  errors: string[];
  timings: Record<string, number>;
}

interface VehicleValidationResult {
  vehicle: VehicleToTest;
  status: "pass" | "fail" | "partial";
  standard: FlowResult;
  lifted?: LiftedFlowResult;
  staggered?: StaggeredFlowResult;
  failureType?: string;
  failureReason?: string;
  durationMs: number;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Create and run a validation batch
 */
export async function runValidation(config: ValidationRunConfig): Promise<string> {
  // 1. Create the run record
  const [run] = await db
    .insert(validationRuns)
    .values({
      name: config.name,
      description: config.description,
      filterYear: config.filterYear,
      filterMake: config.filterMake,
      filterModel: config.filterModel,
      filterBoltPattern: config.filterBoltPattern,
      includeLifted: config.includeLifted ?? true,
      status: "running",
      startedAt: new Date(),
      createdBy: config.createdBy,
    })
    .returning();

  // 2. Get vehicles to test
  const vehicles = await getVehiclesToTest({
    year: config.filterYear,
    make: config.filterMake,
    model: config.filterModel,
    boltPattern: config.filterBoltPattern,
    limit: config.limit,
  });

  // 3. Run tests
  const startTime = Date.now();
  let passCount = 0;
  let failCount = 0;
  let partialCount = 0;
  let staggeredApplicableCount = 0;
  let staggeredPassCount = 0;
  let staggeredFailCount = 0;

  try {
    for (const vehicle of vehicles) {
      const result = await testVehicle(vehicle, config.includeLifted ?? true);
      
      // Track staggered stats
      if (result.staggered?.applicable) {
        staggeredApplicableCount++;
        if (result.staggered.status === "pass") staggeredPassCount++;
        else if (result.staggered.status === "fail") staggeredFailCount++;
      }
      
      // Store result
      await db.insert(validationResults).values({
        runId: run.id,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        modificationId: vehicle.modificationId,
        status: result.status,
        standardTireSizeCount: result.standard.tireSizes.length,
        standardWheelCount: result.standard.wheelCount,
        standardTireCount: result.standard.tireCount,
        standardPackageCount: result.standard.packageCount,
        standardBoltPattern: result.standard.boltPattern,
        standardSource: result.standard.tireSizeSource,
        liftedEnabled: !!result.lifted,
        liftedPresetId: result.lifted?.presetId,
        liftedTireSizeCount: result.lifted?.tireSizes.length ?? 0,
        liftedWheelCount: result.lifted?.wheelCount ?? 0,
        liftedTireCount: result.lifted?.tireCount ?? 0,
        liftedPackageCount: result.lifted?.packageCount ?? 0,
        // Staggered results
        staggeredApplicable: result.staggered?.applicable ?? false,
        staggeredStatus: result.staggered?.status,
        staggeredFrontTireCount: result.staggered?.frontTireCount ?? 0,
        staggeredRearTireCount: result.staggered?.rearTireCount ?? 0,
        staggeredWheelCount: result.staggered?.wheelCount ?? 0,
        staggeredPackageCount: result.staggered?.packageCount ?? 0,
        staggeredFrontSize: result.staggered?.frontTireSize,
        staggeredRearSize: result.staggered?.rearTireSize,
        failureType: result.failureType,
        failureReason: result.failureReason,
        diagnostics: {
          standard: result.standard,
          lifted: result.lifted,
          staggered: result.staggered,
        },
        durationMs: result.durationMs,
      });

      // Update counts
      if (result.status === "pass") passCount++;
      else if (result.status === "fail") failCount++;
      else partialCount++;

      // Small delay to avoid hammering APIs
      await sleep(100);
    }

    // 4. Update run as complete
    const durationMs = Date.now() - startTime;
    await db
      .update(validationRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        durationMs,
        totalVehicles: vehicles.length,
        passCount,
        failCount,
        partialCount,
        staggeredApplicableCount,
        staggeredPassCount,
        staggeredFailCount,
      })
      .where(eq(validationRuns.id, run.id));

  } catch (error: any) {
    // Mark run as failed
    await db
      .update(validationRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        totalVehicles: vehicles.length,
        passCount,
        failCount,
        partialCount,
        errorMessage: error.message,
      })
      .where(eq(validationRuns.id, run.id));
  }

  return run.id;
}

/**
 * Get vehicles from fitment DB matching filter criteria
 */
async function getVehiclesToTest(filters: {
  year?: number;
  make?: string;
  model?: string;
  boltPattern?: string;
  limit?: number;
}): Promise<VehicleToTest[]> {
  const conditions = [];

  if (filters.year) {
    conditions.push(eq(vehicleFitments.year, filters.year));
  }
  if (filters.make) {
    conditions.push(eq(vehicleFitments.make, filters.make));
  }
  if (filters.model) {
    conditions.push(eq(vehicleFitments.model, filters.model));
  }
  if (filters.boltPattern) {
    conditions.push(eq(vehicleFitments.boltPattern, filters.boltPattern));
  }

  // Get distinct year/make/model combinations
  const query = db
    .selectDistinct({
      year: vehicleFitments.year,
      make: vehicleFitments.make,
      model: vehicleFitments.model,
      boltPattern: vehicleFitments.boltPattern,
    })
    .from(vehicleFitments);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const limit = filters.limit || 100;
  query.limit(limit);

  const rows = await query;
  
  return rows.map(r => ({
    year: r.year,
    make: r.make,
    model: r.model,
    boltPattern: r.boltPattern ?? undefined,
  }));
}

/**
 * Test a single vehicle through the full flow
 */
async function testVehicle(
  vehicle: VehicleToTest,
  includeLifted: boolean
): Promise<VehicleValidationResult> {
  const startTime = Date.now();
  
  // Run standard flow
  const standard = await testStandardFlow(vehicle);
  
  // Run lifted flow if enabled and vehicle is a truck/SUV
  let lifted: LiftedFlowResult | undefined;
  if (includeLifted) {
    lifted = await testLiftedFlow(vehicle);
  }
  
  // Run staggered flow (always check, but may not be applicable)
  const staggered = await testStaggeredFlow(vehicle, standard);

  // Determine overall status
  let status: "pass" | "fail" | "partial" = "pass";
  let failureType: string | undefined;
  let failureReason: string | undefined;

  // Check standard flow
  if (standard.tireSizes.length === 0) {
    status = "fail";
    failureType = "no_tire_sizes";
    failureReason = "No tire sizes returned from fitment lookup";
  } else if (standard.wheelCount === 0) {
    status = "fail";
    failureType = "no_wheels";
    failureReason = `No wheels found for bolt pattern ${standard.boltPattern}`;
  } else if (standard.tireCount === 0) {
    status = "partial";
    failureType = "no_tires";
    failureReason = `No tires found for sizes: ${standard.tireSizes.slice(0, 3).join(", ")}`;
  } else if (standard.packageCount === 0) {
    // Packages not found is a soft fail - wheels and tires still work
    status = "partial";
    failureType = "no_packages";
    failureReason = "Wheels and tires found but no packages available";
  }

  // If standard passed but lifted failed, mark as partial
  if (status === "pass" && lifted && lifted.wheelCount === 0 && lifted.tireSizes.length > 0) {
    status = "partial";
    failureType = "lifted_no_wheels";
    failureReason = "Standard flow passed but lifted flow found no wheels";
  }
  
  // Check staggered flow - only affects status if applicable and fails
  if (status === "pass" && staggered.applicable && staggered.status === "fail") {
    status = "partial";
    failureType = "staggered_fail";
    failureReason = "Standard flow passed but staggered fitment validation failed";
  }

  return {
    vehicle,
    status,
    standard,
    lifted,
    staggered,
    failureType,
    failureReason,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Test standard flow: tire sizes -> wheels -> tires -> packages
 */
async function testStandardFlow(vehicle: VehicleToTest): Promise<FlowResult> {
  const errors: string[] = [];
  const timings: Record<string, number> = {};
  let tireSizes: string[] = [];
  let tireSizeSource: string | undefined;
  let boltPattern: string | undefined;
  let wheelCount = 0;
  let tireCount = 0;
  let packageCount = 0;

  // Step 1: Get tire sizes
  const t1 = Date.now();
  try {
    const tireSizesUrl = `${BASE_URL}/api/vehicles/tire-sizes?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
    const tireSizesRes = await fetch(tireSizesUrl, { cache: "no-store" });
    if (tireSizesRes.ok) {
      const data = await tireSizesRes.json();
      tireSizes = data.tireSizes || data.searchableSizes || [];
      tireSizeSource = data.source;
      boltPattern = data.fitment?.boltPattern;
    } else {
      errors.push(`tire-sizes returned ${tireSizesRes.status}`);
    }
  } catch (e: any) {
    errors.push(`tire-sizes error: ${e.message}`);
  }
  timings.tireSizes = Date.now() - t1;

  if (tireSizes.length === 0) {
    return { tireSizes, tireSizeSource, boltPattern, wheelCount, tireCount, packageCount, errors, timings };
  }

  // Step 2: Get wheels (using bolt pattern)
  if (boltPattern) {
    const t2 = Date.now();
    try {
      const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?boltPattern=${encodeURIComponent(boltPattern)}&limit=10`;
      const wheelsRes = await fetch(wheelsUrl, { cache: "no-store" });
      if (wheelsRes.ok) {
        const data = await wheelsRes.json();
        wheelCount = data.total ?? data.wheels?.length ?? 0;
      } else {
        errors.push(`wheels returned ${wheelsRes.status}`);
      }
    } catch (e: any) {
      errors.push(`wheels error: ${e.message}`);
    }
    timings.wheels = Date.now() - t2;
  }

  // Step 3: Get tires (using first tire size)
  const tireSize = tireSizes[0];
  if (tireSize) {
    const t3 = Date.now();
    try {
      const tiresUrl = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(tireSize)}&limit=10`;
      const tiresRes = await fetch(tiresUrl, { cache: "no-store" });
      if (tiresRes.ok) {
        const data = await tiresRes.json();
        tireCount = data.total ?? data.tires?.length ?? 0;
      } else {
        errors.push(`tires returned ${tiresRes.status}`);
      }
    } catch (e: any) {
      errors.push(`tires error: ${e.message}`);
    }
    timings.tires = Date.now() - t3;
  }

  // Step 4: Check packages (estimate based on wheel + tire availability)
  if (wheelCount > 0 && tireCount > 0) {
    packageCount = Math.min(wheelCount, tireCount) * 4; // Rough estimate
  }

  return { tireSizes, tireSizeSource, boltPattern, wheelCount, tireCount, packageCount, errors, timings };
}

/**
 * Test lifted flow using lift recommendations
 */
async function testLiftedFlow(vehicle: VehicleToTest): Promise<LiftedFlowResult | undefined> {
  // Check if vehicle has lift recommendations
  const liftResult = getLiftRecommendation(
    vehicle.make,
    vehicle.model,
    vehicle.year,
    "daily"
  );
  
  if (!liftResult) {
    return undefined;
  }

  const errors: string[] = [];
  const timings: Record<string, number> = {};
  const preset = liftResult.recommendation;
  const presetId = "daily";
  const liftInches = 2; // Default daily driver lift

  // Get tire sizes from lift recommendations
  const tireSizes = preset.commonTireSizes.slice(0, 5);
  
  let wheelCount = 0;
  let tireCount = 0;
  let packageCount = 0;

  // Get wheels with lifted offset range
  if (vehicle.boltPattern) {
    const t1 = Date.now();
    try {
      const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?boltPattern=${encodeURIComponent(vehicle.boltPattern)}&offsetMin=${preset.offsetMin}&offsetMax=${preset.offsetMax}&limit=10`;
      const wheelsRes = await fetch(wheelsUrl, { cache: "no-store" });
      if (wheelsRes.ok) {
        const data = await wheelsRes.json();
        wheelCount = data.total ?? data.wheels?.length ?? 0;
      }
    } catch (e: any) {
      errors.push(`lifted wheels error: ${e.message}`);
    }
    timings.wheels = Date.now() - t1;
  }

  // Get tires
  if (tireSizes.length > 0) {
    const t2 = Date.now();
    try {
      const tiresUrl = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(tireSizes[0])}&limit=10`;
      const tiresRes = await fetch(tiresUrl, { cache: "no-store" });
      if (tiresRes.ok) {
        const data = await tiresRes.json();
        tireCount = data.total ?? data.tires?.length ?? 0;
      }
    } catch (e: any) {
      errors.push(`lifted tires error: ${e.message}`);
    }
    timings.tires = Date.now() - t2;
  }

  if (wheelCount > 0 && tireCount > 0) {
    packageCount = Math.min(wheelCount, tireCount) * 4;
  }

  return {
    presetId,
    liftInches,
    tireSizes,
    wheelCount,
    tireCount,
    packageCount,
    errors,
    timings,
  };
}

/**
 * Test staggered fitment flow
 * 
 * Staggered fitment = different front/rear tire sizes (common on performance cars)
 * Only applicable to vehicles that actually have staggered OEM fitment.
 */
async function testStaggeredFlow(
  vehicle: VehicleToTest,
  standardResult: FlowResult
): Promise<StaggeredFlowResult> {
  const errors: string[] = [];
  const timings: Record<string, number> = {};
  
  // Check if vehicle has staggered fitment by looking for different front/rear sizes
  // This comes from the tire sizes API response
  const staggeredSizes = detectStaggeredSizes(standardResult.tireSizes);
  
  if (!staggeredSizes) {
    // Not a staggered vehicle - mark as skipped, not failed
    return {
      applicable: false,
      status: "skipped",
      frontTireCount: 0,
      rearTireCount: 0,
      wheelCount: 0,
      packageCount: 0,
      errors: [],
      timings: {},
    };
  }
  
  const { frontSize, rearSize } = staggeredSizes;
  let frontTireCount = 0;
  let rearTireCount = 0;
  let wheelCount = 0;
  let packageCount = 0;
  
  // Test front tires
  const t1 = Date.now();
  try {
    const frontUrl = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(frontSize)}&limit=10`;
    const frontRes = await fetch(frontUrl, { cache: "no-store" });
    if (frontRes.ok) {
      const data = await frontRes.json();
      frontTireCount = data.total ?? data.tires?.length ?? 0;
    } else {
      errors.push(`front tires returned ${frontRes.status}`);
    }
  } catch (e: any) {
    errors.push(`front tires error: ${e.message}`);
  }
  timings.frontTires = Date.now() - t1;
  
  // Test rear tires
  const t2 = Date.now();
  try {
    const rearUrl = `${BASE_URL}/api/tires/search?size=${encodeURIComponent(rearSize)}&limit=10`;
    const rearRes = await fetch(rearUrl, { cache: "no-store" });
    if (rearRes.ok) {
      const data = await rearRes.json();
      rearTireCount = data.total ?? data.tires?.length ?? 0;
    } else {
      errors.push(`rear tires returned ${rearRes.status}`);
    }
  } catch (e: any) {
    errors.push(`rear tires error: ${e.message}`);
  }
  timings.rearTires = Date.now() - t2;
  
  // Use wheel count from standard flow (same wheels work for staggered)
  wheelCount = standardResult.wheelCount;
  
  // Package count: estimate based on having both front and rear tires + wheels
  if (frontTireCount > 0 && rearTireCount > 0 && wheelCount > 0) {
    packageCount = Math.min(frontTireCount, rearTireCount, Math.floor(wheelCount / 2)) * 2;
  }
  
  // Determine status
  let status: "pass" | "fail" | "skipped" = "pass";
  
  if (frontTireCount === 0) {
    status = "fail";
    errors.push(`No front tires found for size ${frontSize}`);
  }
  if (rearTireCount === 0) {
    status = "fail";
    errors.push(`No rear tires found for size ${rearSize}`);
  }
  if (frontTireCount > 0 && rearTireCount > 0 && packageCount === 0) {
    status = "fail";
    errors.push("Front and rear tires found but package build failed");
  }
  
  return {
    applicable: true,
    status,
    frontTireSize: frontSize,
    rearTireSize: rearSize,
    frontTireCount,
    rearTireCount,
    wheelCount,
    packageCount,
    errors,
    timings,
  };
}

/**
 * Detect if tire sizes represent staggered fitment
 * 
 * Staggered vehicles typically have:
 * - Different width front/rear (e.g., 245/40R18 front, 275/35R18 rear)
 * - Same diameter (both R18, both R19, etc.)
 * 
 * Common patterns:
 * - BMW M cars: 255/35R19 F, 275/35R19 R
 * - Mustang GT: 255/40R19 F, 275/40R19 R
 * - Camaro SS: 245/40R20 F, 275/35R20 R
 * - Mercedes AMG: 255/35R19 F, 285/30R19 R
 */
function detectStaggeredSizes(tireSizes: string[]): { frontSize: string; rearSize: string } | null {
  if (!tireSizes || tireSizes.length < 2) {
    return null;
  }
  
  // Parse tire sizes to extract dimensions
  const parsed = tireSizes.map(size => {
    // Handle formats like "245/40R18", "255/40ZR19", "P245/45R18"
    const match = size.match(/^P?(\d+)\/(\d+)Z?R(\d+)/i);
    if (!match) return null;
    return {
      original: size,
      width: parseInt(match[1], 10),
      aspect: parseInt(match[2], 10),
      diameter: parseInt(match[3], 10),
    };
  }).filter(Boolean) as Array<{ original: string; width: number; aspect: number; diameter: number }>;
  
  if (parsed.length < 2) {
    return null;
  }
  
  // Group by diameter
  const byDiameter = new Map<number, typeof parsed>();
  for (const tire of parsed) {
    const existing = byDiameter.get(tire.diameter) || [];
    existing.push(tire);
    byDiameter.set(tire.diameter, existing);
  }
  
  // Look for staggered pattern: same diameter, different widths
  for (const [diameter, tires] of Array.from(byDiameter.entries())) {
    if (tires.length < 2) continue;
    
    // Sort by width
    const sorted = [...tires].sort((a, b) => a.width - b.width);
    const narrowest = sorted[0];
    const widest = sorted[sorted.length - 1];
    
    // Check if there's meaningful width difference (at least 20mm)
    if (widest.width - narrowest.width >= 20) {
      return {
        frontSize: narrowest.original,
        rearSize: widest.original,
      };
    }
  }
  
  return null;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all validation runs
 */
export async function getValidationRuns(options?: {
  status?: string;
  limit?: number;
}): Promise<ValidationRun[]> {
  const conditions = [];
  
  if (options?.status) {
    conditions.push(eq(validationRuns.status, options.status));
  }

  const query = db
    .select()
    .from(validationRuns)
    .orderBy(desc(validationRuns.createdAt))
    .limit(options?.limit ?? 50);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  return query;
}

/**
 * Get a single run with summary stats
 */
export async function getValidationRun(runId: string): Promise<ValidationRun | null> {
  const [run] = await db
    .select()
    .from(validationRuns)
    .where(eq(validationRuns.id, runId))
    .limit(1);
  
  return run || null;
}

/**
 * Get results for a run with filters
 */
export async function getValidationResults(options: {
  runId?: string;
  status?: string;
  failureType?: string;
  make?: string;
  model?: string;
  limit?: number;
  offset?: number;
}): Promise<{ results: ValidationResult[]; total: number }> {
  const conditions = [];

  if (options.runId) {
    conditions.push(eq(validationResults.runId, options.runId));
  }
  if (options.status) {
    conditions.push(eq(validationResults.status, options.status));
  }
  if (options.failureType) {
    conditions.push(eq(validationResults.failureType, options.failureType));
  }
  if (options.make) {
    conditions.push(eq(validationResults.make, options.make));
  }
  if (options.model) {
    conditions.push(eq(validationResults.model, options.model));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(validationResults)
    .where(whereClause);

  // Get paginated results
  const results = await db
    .select()
    .from(validationResults)
    .where(whereClause)
    .orderBy(desc(validationResults.testedAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);

  return { results, total: count };
}

/**
 * Get a single result with full diagnostics
 */
export async function getValidationResult(id: string): Promise<ValidationResult | null> {
  const [result] = await db
    .select()
    .from(validationResults)
    .where(eq(validationResults.id, id))
    .limit(1);
  
  return result || null;
}

/**
 * Rerun failed vehicles from a previous run
 */
export async function rerunFailedVehicles(
  runId: string,
  createdBy?: string
): Promise<string> {
  // Get failed results from the run
  const { results } = await getValidationResults({
    runId,
    status: "fail",
  });

  if (results.length === 0) {
    throw new Error("No failed vehicles to rerun");
  }

  // Get the original run for reference
  const originalRun = await getValidationRun(runId);

  // Create new run
  const [newRun] = await db
    .insert(validationRuns)
    .values({
      name: `Rerun: ${originalRun?.name || "Unknown"}`,
      description: `Rerunning ${results.length} failed vehicles from run ${runId}`,
      includeLifted: originalRun?.includeLifted ?? true,
      status: "running",
      startedAt: new Date(),
      createdBy,
    })
    .returning();

  // Test each vehicle
  const startTime = Date.now();
  let passCount = 0;
  let failCount = 0;
  let partialCount = 0;

  for (const oldResult of results) {
    const vehicle: VehicleToTest = {
      year: oldResult.year,
      make: oldResult.make,
      model: oldResult.model,
      trim: oldResult.trim ?? undefined,
      modificationId: oldResult.modificationId ?? undefined,
    };

    const result = await testVehicle(vehicle, originalRun?.includeLifted ?? true);

    await db.insert(validationResults).values({
      runId: newRun.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      modificationId: vehicle.modificationId,
      status: result.status,
      standardTireSizeCount: result.standard.tireSizes.length,
      standardWheelCount: result.standard.wheelCount,
      standardTireCount: result.standard.tireCount,
      standardPackageCount: result.standard.packageCount,
      standardBoltPattern: result.standard.boltPattern,
      standardSource: result.standard.tireSizeSource,
      liftedEnabled: !!result.lifted,
      liftedPresetId: result.lifted?.presetId,
      liftedTireSizeCount: result.lifted?.tireSizes.length ?? 0,
      liftedWheelCount: result.lifted?.wheelCount ?? 0,
      liftedTireCount: result.lifted?.tireCount ?? 0,
      liftedPackageCount: result.lifted?.packageCount ?? 0,
      // Staggered results
      staggeredApplicable: result.staggered?.applicable ?? false,
      staggeredStatus: result.staggered?.status,
      staggeredFrontTireCount: result.staggered?.frontTireCount ?? 0,
      staggeredRearTireCount: result.staggered?.rearTireCount ?? 0,
      staggeredWheelCount: result.staggered?.wheelCount ?? 0,
      staggeredPackageCount: result.staggered?.packageCount ?? 0,
      staggeredFrontSize: result.staggered?.frontTireSize,
      staggeredRearSize: result.staggered?.rearTireSize,
      failureType: result.failureType,
      failureReason: result.failureReason,
      diagnostics: {
        standard: result.standard,
        lifted: result.lifted,
        staggered: result.staggered,
      },
      durationMs: result.durationMs,
    });

    if (result.status === "pass") passCount++;
    else if (result.status === "fail") failCount++;
    else partialCount++;

    await sleep(100);
  }

  // Update run
  await db
    .update(validationRuns)
    .set({
      status: "completed",
      completedAt: new Date(),
      durationMs: Date.now() - startTime,
      totalVehicles: results.length,
      passCount,
      failCount,
      partialCount,
    })
    .where(eq(validationRuns.id, newRun.id));

  return newRun.id;
}

/**
 * Get failure type breakdown for a run
 */
export async function getFailureBreakdown(runId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({
      failureType: validationResults.failureType,
      count: sql<number>`count(*)::int`,
    })
    .from(validationResults)
    .where(and(
      eq(validationResults.runId, runId),
      sql`${validationResults.failureType} IS NOT NULL`
    ))
    .groupBy(validationResults.failureType);

  const breakdown: Record<string, number> = {};
  for (const row of rows) {
    if (row.failureType) {
      breakdown[row.failureType] = row.count;
    }
  }
  return breakdown;
}

/**
 * Export results as CSV
 */
export async function exportResultsAsCsv(runId: string): Promise<string> {
  const { results } = await getValidationResults({ runId, limit: 10000 });

  const headers = [
    "Year",
    "Make",
    "Model",
    "Status",
    "Failure Type",
    "Failure Reason",
    "Tire Sizes",
    "Bolt Pattern",
    "Wheel Count",
    "Tire Count",
    "Lifted Enabled",
    "Lifted Wheel Count",
    "Lifted Tire Count",
    "Staggered Applicable",
    "Staggered Status",
    "Staggered Front Size",
    "Staggered Rear Size",
    "Staggered Front Tires",
    "Staggered Rear Tires",
    "Duration (ms)",
  ];

  const rows = results.map(r => [
    r.year,
    r.make,
    r.model,
    r.status,
    r.failureType || "",
    (r.failureReason || "").replace(/"/g, '""'),
    r.standardTireSizeCount,
    r.standardBoltPattern || "",
    r.standardWheelCount,
    r.standardTireCount,
    r.liftedEnabled,
    r.liftedWheelCount,
    r.liftedTireCount,
    r.staggeredApplicable,
    r.staggeredStatus || "",
    r.staggeredFrontSize || "",
    r.staggeredRearSize || "",
    r.staggeredFrontTireCount,
    r.staggeredRearTireCount,
    r.durationMs,
  ]);

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(v => `"${v}"`).join(",")),
  ].join("\n");

  return csv;
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
