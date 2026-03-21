/**
 * Fitment Repair Service
 * 
 * Proactively scans and repairs incomplete fitment records.
 * Runs assessFitmentQuality() on each record and triggers re-import for invalid ones.
 */

import { db } from "./db";
import { vehicleFitments } from "./schema";
import type { VehicleFitment } from "./schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { assessFitmentQuality, getFitmentProfile, type FitmentQuality } from "./profileService";

// ============================================================================
// Types
// ============================================================================

export interface RepairResult {
  id: string;
  year: number;
  make: string;
  model: string;
  modificationId: string;
  displayTrim: string;
  beforeQuality: FitmentQuality;
  afterQuality: FitmentQuality;
  reasons: string[];
  repaired: boolean;
  error?: string;
}

export interface RepairReport {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: {
    totalScanned: number;
    alreadyValid: number;
    partialRecords: number;
    invalidRecords: number;
    repairedSuccessfully: number;
    stillUnresolved: number;
    errors: number;
  };
  repaired: RepairResult[];
  unresolved: RepairResult[];
  errors: RepairResult[];
}

// ============================================================================
// Scan Functions
// ============================================================================

/**
 * Find all potentially problematic fitment records
 */
export async function findProblematicRecords(options?: {
  limit?: number;
  yearMin?: number;
  yearMax?: number;
  make?: string;
}): Promise<VehicleFitment[]> {
  const { limit = 1000, yearMin, yearMax, make } = options || {};
  
  // Query for records that might be invalid:
  // - null boltPattern
  // - empty oemWheelSizes
  // - empty oemTireSizes
  const conditions = [
    isNull(vehicleFitments.boltPattern),
    sql`${vehicleFitments.oemWheelSizes} = '[]'::jsonb`,
    sql`${vehicleFitments.oemTireSizes} = '[]'::jsonb`,
  ];
  
  let whereClause = or(...conditions);
  
  // Add optional filters
  if (yearMin || yearMax || make) {
    const extraConditions = [];
    if (yearMin) extraConditions.push(sql`${vehicleFitments.year} >= ${yearMin}`);
    if (yearMax) extraConditions.push(sql`${vehicleFitments.year} <= ${yearMax}`);
    if (make) extraConditions.push(eq(vehicleFitments.make, make.toLowerCase()));
    
    if (extraConditions.length > 0) {
      whereClause = and(whereClause, ...extraConditions);
    }
  }
  
  const records = await db.query.vehicleFitments.findMany({
    where: whereClause,
    limit,
    orderBy: [vehicleFitments.year, vehicleFitments.make, vehicleFitments.model],
  });
  
  console.log(`[repairService] Found ${records.length} potentially problematic records`);
  return records;
}

/**
 * Get quality breakdown of all records
 */
export async function getQualityBreakdown(): Promise<{
  total: number;
  valid: number;
  partial: number;
  invalid: number;
  samples: { quality: FitmentQuality; vehicle: string }[];
}> {
  // Get all records (or a sample)
  const records = await db.query.vehicleFitments.findMany({
    limit: 5000, // Reasonable sample size
  });
  
  let valid = 0;
  let partial = 0;
  let invalid = 0;
  const samples: { quality: FitmentQuality; vehicle: string }[] = [];
  
  for (const record of records) {
    const { quality } = assessFitmentQuality(record);
    
    if (quality === "valid") valid++;
    else if (quality === "partial") partial++;
    else invalid++;
    
    // Collect samples (first 3 of each type)
    const sampleCount = samples.filter(s => s.quality === quality).length;
    if (sampleCount < 3) {
      samples.push({
        quality,
        vehicle: `${record.year} ${record.make} ${record.model} (${record.displayTrim})`,
      });
    }
  }
  
  return { total: records.length, valid, partial, invalid, samples };
}

// ============================================================================
// Repair Functions
// ============================================================================

/**
 * Attempt to repair a single fitment record
 */
export async function repairSingleRecord(record: VehicleFitment): Promise<RepairResult> {
  const { quality: beforeQuality, reasons } = assessFitmentQuality(record);
  
  const result: RepairResult = {
    id: record.id,
    year: record.year,
    make: record.make,
    model: record.model,
    modificationId: record.modificationId,
    displayTrim: record.displayTrim,
    beforeQuality,
    afterQuality: beforeQuality,
    reasons,
    repaired: false,
  };
  
  // Already valid - no repair needed
  if (beforeQuality === "valid") {
    return result;
  }
  
  try {
    // Force refresh from API
    console.log(`[repairService] Attempting repair: ${record.year} ${record.make} ${record.model} mod=${record.modificationId}`);
    
    const profileResult = await getFitmentProfile(
      record.year,
      record.make,
      record.model,
      record.modificationId,
      { forceRefresh: true }
    );
    
    if (!profileResult.profile) {
      result.error = "API returned no data";
      return result;
    }
    
    // Re-fetch the record to check new quality
    const updatedRecord = await db.query.vehicleFitments.findFirst({
      where: eq(vehicleFitments.id, record.id),
    });
    
    if (!updatedRecord) {
      result.error = "Record not found after repair attempt";
      return result;
    }
    
    const { quality: afterQuality } = assessFitmentQuality(updatedRecord);
    result.afterQuality = afterQuality;
    
    if (afterQuality === "valid" || (beforeQuality === "invalid" && afterQuality === "partial")) {
      result.repaired = true;
      console.log(`[repairService] ✓ Repaired: ${record.year} ${record.make} ${record.model} (${beforeQuality} → ${afterQuality})`);
    } else {
      console.log(`[repairService] ✗ Still unresolved: ${record.year} ${record.make} ${record.model} (${beforeQuality} → ${afterQuality})`);
    }
    
  } catch (err: any) {
    result.error = err?.message || "Unknown error";
    console.error(`[repairService] Error repairing ${record.year} ${record.make} ${record.model}:`, err?.message);
  }
  
  return result;
}

/**
 * Run repair sweep on all problematic records
 */
export async function runRepairSweep(options?: {
  limit?: number;
  yearMin?: number;
  yearMax?: number;
  make?: string;
  dryRun?: boolean;
  delayMs?: number;
}): Promise<RepairReport> {
  const { limit = 100, dryRun = false, delayMs = 500, ...filters } = options || {};
  
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  
  console.log(`[repairService] Starting repair sweep (limit=${limit}, dryRun=${dryRun})`);
  
  // Find problematic records
  const records = await findProblematicRecords({ limit, ...filters });
  
  const results: RepairResult[] = [];
  let alreadyValid = 0;
  
  for (const record of records) {
    const { quality } = assessFitmentQuality(record);
    
    if (quality === "valid") {
      alreadyValid++;
      continue;
    }
    
    if (dryRun) {
      // Dry run - just assess without repairing
      results.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        modificationId: record.modificationId,
        displayTrim: record.displayTrim,
        beforeQuality: quality,
        afterQuality: quality,
        reasons: assessFitmentQuality(record).reasons,
        repaired: false,
      });
    } else {
      // Actual repair
      const result = await repairSingleRecord(record);
      results.push(result);
      
      // Delay between API calls to avoid rate limiting
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - t0;
  
  // Build report
  const repaired = results.filter(r => r.repaired);
  const unresolved = results.filter(r => !r.repaired && !r.error && r.beforeQuality !== "valid");
  const errors = results.filter(r => r.error);
  
  const report: RepairReport = {
    startedAt,
    completedAt,
    durationMs,
    summary: {
      totalScanned: records.length,
      alreadyValid,
      partialRecords: results.filter(r => r.beforeQuality === "partial").length,
      invalidRecords: results.filter(r => r.beforeQuality === "invalid").length,
      repairedSuccessfully: repaired.length,
      stillUnresolved: unresolved.length,
      errors: errors.length,
    },
    repaired,
    unresolved,
    errors,
  };
  
  console.log(`[repairService] Sweep complete:`, report.summary);
  
  return report;
}

// ============================================================================
// Report Formatting
// ============================================================================

export function formatReportAsText(report: RepairReport): string {
  const lines: string[] = [];
  
  lines.push("═══════════════════════════════════════════════════════════════════");
  lines.push("                    FITMENT REPAIR REPORT");
  lines.push("═══════════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Started:    ${report.startedAt}`);
  lines.push(`Completed:  ${report.completedAt}`);
  lines.push(`Duration:   ${(report.durationMs / 1000).toFixed(1)}s`);
  lines.push("");
  lines.push("─────────────────────────────────────────────────────────────────────");
  lines.push("                          SUMMARY");
  lines.push("─────────────────────────────────────────────────────────────────────");
  lines.push(`Total Scanned:        ${report.summary.totalScanned}`);
  lines.push(`Already Valid:        ${report.summary.alreadyValid}`);
  lines.push(`Partial Records:      ${report.summary.partialRecords}`);
  lines.push(`Invalid Records:      ${report.summary.invalidRecords}`);
  lines.push(`Repaired Successfully: ${report.summary.repairedSuccessfully} ✓`);
  lines.push(`Still Unresolved:     ${report.summary.stillUnresolved} ✗`);
  lines.push(`Errors:               ${report.summary.errors}`);
  lines.push("");
  
  if (report.repaired.length > 0) {
    lines.push("─────────────────────────────────────────────────────────────────────");
    lines.push("                    REPAIRED SUCCESSFULLY");
    lines.push("─────────────────────────────────────────────────────────────────────");
    for (const r of report.repaired.slice(0, 20)) {
      lines.push(`✓ ${r.year} ${r.make} ${r.model} (${r.displayTrim})`);
      lines.push(`  ${r.beforeQuality} → ${r.afterQuality}`);
    }
    if (report.repaired.length > 20) {
      lines.push(`  ... and ${report.repaired.length - 20} more`);
    }
    lines.push("");
  }
  
  if (report.unresolved.length > 0) {
    lines.push("─────────────────────────────────────────────────────────────────────");
    lines.push("                    STILL UNRESOLVED");
    lines.push("─────────────────────────────────────────────────────────────────────");
    for (const r of report.unresolved.slice(0, 20)) {
      lines.push(`✗ ${r.year} ${r.make} ${r.model} (${r.displayTrim})`);
      lines.push(`  Reasons: ${r.reasons.join(", ")}`);
    }
    if (report.unresolved.length > 20) {
      lines.push(`  ... and ${report.unresolved.length - 20} more`);
    }
    lines.push("");
  }
  
  if (report.errors.length > 0) {
    lines.push("─────────────────────────────────────────────────────────────────────");
    lines.push("                         ERRORS");
    lines.push("─────────────────────────────────────────────────────────────────────");
    for (const r of report.errors.slice(0, 10)) {
      lines.push(`⚠ ${r.year} ${r.make} ${r.model} (${r.displayTrim})`);
      lines.push(`  Error: ${r.error}`);
    }
    if (report.errors.length > 10) {
      lines.push(`  ... and ${report.errors.length - 10} more`);
    }
    lines.push("");
  }
  
  lines.push("═══════════════════════════════════════════════════════════════════");
  
  return lines.join("\n");
}
