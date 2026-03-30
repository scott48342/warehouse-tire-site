/**
 * Fitment Import Service (STUB)
 * 
 * External API import has been removed. This file provides stub exports
 * for backwards compatibility. Use static data import tools instead.
 */

import { db } from "./db";
import { fitmentSourceRecords, vehicleFitments, fitmentImportJobs } from "./schema";
import type { NewFitmentSourceRecord, NewVehicleFitment, NewFitmentImportJob } from "./schema";
import { eq, and } from "drizzle-orm";
import { makePayloadChecksum, normalizeMake, normalizeModel, slugify } from "./keys";
import { normalizeWheelSizeData, createWheelSizeSourceRecord } from "./normalize";

// ============================================================================
// Single Record Import (DB-only, from static data)
// ============================================================================

interface ImportResult {
  success: boolean;
  action: "created" | "updated" | "skipped" | "error";
  fitmentId?: string;
  sourceRecordId?: string;
  error?: string;
}

/**
 * Import a single fitment record from static data
 * NOTE: Wheel-Size API import has been removed. Use for static data only.
 */
export async function importStaticFitment(
  year: number,
  make: string,
  model: string,
  modification: {
    slug: string;
    name?: string;
    trim?: string;
  },
  fitmentData: {
    boltPattern?: string;
    centerBoreMm?: number;
    threadSize?: string;
    seatType?: string;
    oemTireSizes?: string[];
    oemWheelSizes?: any[];
  }
): Promise<ImportResult> {
  try {
    const sourceId = modification.slug;
    const checksum = makePayloadChecksum({ modification, fitmentData });
    
    // Check if we already have this source record with same checksum
    const existingSource = await db.query.fitmentSourceRecords.findFirst({
      where: and(
        eq(fitmentSourceRecords.source, "static"),
        eq(fitmentSourceRecords.sourceId, sourceId)
      ),
    });
    
    if (existingSource && existingSource.checksum === checksum) {
      return { success: true, action: "skipped", sourceRecordId: existingSource.id };
    }
    
    // Create or update source record
    const sourceRecord: NewFitmentSourceRecord = {
      source: "static",
      sourceId,
      year,
      make: normalizeMake(make),
      model: normalizeModel(model),
      rawPayload: { modification, fitmentData } as Record<string, unknown>,
      checksum,
    };
    
    let sourceRecordId: string;
    
    if (existingSource) {
      await db
        .update(fitmentSourceRecords)
        .set({
          rawPayload: sourceRecord.rawPayload,
          checksum: sourceRecord.checksum,
          fetchedAt: new Date(),
        })
        .where(eq(fitmentSourceRecords.id, existingSource.id));
      sourceRecordId = existingSource.id;
    } else {
      const [inserted] = await db
        .insert(fitmentSourceRecords)
        .values(sourceRecord)
        .returning({ id: fitmentSourceRecords.id });
      sourceRecordId = inserted.id;
    }
    
    // Build fitment record
    const modificationId = slugify(modification.slug);
    const displayTrim = modification.trim || modification.name || "Base";
    
    const fitmentRecord: NewVehicleFitment = {
      year,
      make: normalizeMake(make),
      model: normalizeModel(model),
      modificationId,
      displayTrim,
      rawTrim: modification.trim || null,
      boltPattern: fitmentData.boltPattern || null,
      centerBoreMm: fitmentData.centerBoreMm ? String(fitmentData.centerBoreMm) : null,
      threadSize: fitmentData.threadSize || null,
      seatType: fitmentData.seatType || null,
      oemTireSizes: fitmentData.oemTireSizes || [],
      oemWheelSizes: fitmentData.oemWheelSizes || [],
      source: "static",
      sourceRecordId,
    };
    
    // Check if fitment exists
    const existingFitment = await db.query.vehicleFitments.findFirst({
      where: and(
        eq(vehicleFitments.year, year),
        eq(vehicleFitments.make, fitmentRecord.make),
        eq(vehicleFitments.model, fitmentRecord.model),
        eq(vehicleFitments.modificationId, fitmentRecord.modificationId)
      ),
    });
    
    let fitmentId: string;
    let action: "created" | "updated";
    
    if (existingFitment) {
      await db
        .update(vehicleFitments)
        .set({
          ...fitmentRecord,
          updatedAt: new Date(),
        })
        .where(eq(vehicleFitments.id, existingFitment.id));
      fitmentId = existingFitment.id;
      action = "updated";
    } else {
      const [inserted] = await db
        .insert(vehicleFitments)
        .values(fitmentRecord)
        .returning({ id: vehicleFitments.id });
      fitmentId = inserted.id;
      action = "created";
    }
    
    return { success: true, action, fitmentId, sourceRecordId };
  } catch (error: any) {
    console.error("[importStaticFitment] Error:", error?.message);
    return { success: false, action: "error", error: error?.message };
  }
}

// ============================================================================
// Deprecated exports (for backwards compatibility)
// ============================================================================

/**
 * @deprecated Wheel-Size API import has been removed
 */
export async function importWheelSizeFitment(): Promise<ImportResult> {
  return {
    success: false,
    action: "error",
    error: "Wheel-Size API import is disabled. Use importStaticFitment instead.",
  };
}

/**
 * @deprecated Wheel-Size API import has been removed
 */
export async function importFromWheelSize(): Promise<void> {
  throw new Error("Wheel-Size API import is disabled. Use static data import tools instead.");
}

// ============================================================================
// Import Job Management (kept for compatibility)
// ============================================================================

/**
 * Create a new import job
 */
export async function createImportJob(
  source: string,
  yearStart?: number,
  yearEnd?: number,
  makes?: string[]
): Promise<string> {
  const job: NewFitmentImportJob = {
    source,
    yearStart: yearStart ?? null,
    yearEnd: yearEnd ?? null,
    makes: makes ?? null,
    status: "pending",
  };
  
  const [inserted] = await db
    .insert(fitmentImportJobs)
    .values(job)
    .returning({ id: fitmentImportJobs.id });
  
  return inserted.id;
}

/**
 * Update import job progress
 */
export async function updateImportJobProgress(
  jobId: string,
  progress: {
    status?: string;
    totalRecords?: number;
    processedRecords?: number;
    importedRecords?: number;
    skippedRecords?: number;
    errorCount?: number;
    lastError?: string;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {};
  
  if (progress.status) {
    updates.status = progress.status;
    if (progress.status === "running") {
      updates.startedAt = new Date();
    }
    if (progress.status === "completed" || progress.status === "failed") {
      updates.completedAt = new Date();
    }
  }
  if (progress.totalRecords !== undefined) updates.totalRecords = progress.totalRecords;
  if (progress.processedRecords !== undefined) updates.processedRecords = progress.processedRecords;
  if (progress.importedRecords !== undefined) updates.importedRecords = progress.importedRecords;
  if (progress.skippedRecords !== undefined) updates.skippedRecords = progress.skippedRecords;
  if (progress.errorCount !== undefined) updates.errorCount = progress.errorCount;
  if (progress.lastError !== undefined) updates.lastError = progress.lastError;
  
  await db
    .update(fitmentImportJobs)
    .set(updates)
    .where(eq(fitmentImportJobs.id, jobId));
}

/**
 * Get import job status
 */
export async function getImportJob(jobId: string) {
  return db.query.fitmentImportJobs.findFirst({
    where: eq(fitmentImportJobs.id, jobId),
  });
}
