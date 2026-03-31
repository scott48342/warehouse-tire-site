/**
 * Fitment Import Service
 * 
 * Imports fitment data from external APIs and stores in database.
 * Handles deduplication, change detection, and source tracking.
 */

import { db } from "./db";
import { fitmentSourceRecords, vehicleFitments, fitmentImportJobs } from "./schema";
import type { NewFitmentSourceRecord, NewVehicleFitment, NewFitmentImportJob } from "./schema";
import { eq, and } from "drizzle-orm";
import { makePayloadChecksum, normalizeMake, normalizeModel, slugify } from "./keys";
import { normalizeWheelSizeData, createWheelSizeSourceRecord } from "./normalize";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// Runtime imports are blocked. Use bulk-import scripts only for data seeding.
// ============================================================================

// ============================================================================
// Single Record Import
// ============================================================================

interface ImportResult {
  success: boolean;
  action: "created" | "updated" | "skipped" | "error";
  fitmentId?: string;
  sourceRecordId?: string;
  error?: string;
}

/**
 * Import a single fitment record from Wheel-Size API
 */
export async function importWheelSizeFitment(
  year: number,
  make: string,
  model: string,
  modification: {
    slug: string;
    name?: string;
    trim?: string;
    engine?: unknown;
    body?: string;
  },
  wheelData?: unknown,
  tireData?: unknown,
  fullPayload?: unknown
): Promise<ImportResult> {
  try {
    const sourceId = modification.slug;
    const checksum = makePayloadChecksum(fullPayload || modification);
    
    // Check if we already have this source record with same checksum
    const existingSource = await db.query.fitmentSourceRecords.findFirst({
      where: and(
        eq(fitmentSourceRecords.source, "wheelsize"),
        eq(fitmentSourceRecords.sourceId, sourceId)
      ),
    });
    
    if (existingSource && existingSource.checksum === checksum) {
      // Data unchanged, skip
      return { success: true, action: "skipped", sourceRecordId: existingSource.id };
    }
    
    // Create or update source record
    const sourceRecord: NewFitmentSourceRecord = {
      source: "wheelsize",
      sourceId,
      year,
      make: normalizeMake(make),
      model: normalizeModel(model),
      rawPayload: (fullPayload || modification) as Record<string, unknown>,
      checksum,
    };
    
    let sourceRecordId: string;
    
    if (existingSource) {
      // Update existing
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
      // Insert new
      const [inserted] = await db
        .insert(fitmentSourceRecords)
        .values(sourceRecord)
        .returning({ id: fitmentSourceRecords.id });
      sourceRecordId = inserted.id;
    }
    
    // Normalize and upsert fitment record
    const normalizedFitment = normalizeWheelSizeData(
      year,
      make,
      model,
      modification as any,
      wheelData as any,
      tireData as any
    );
    
    const fitmentRecord: NewVehicleFitment = {
      ...normalizedFitment,
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
      // Update existing
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
      // Insert new
      const [inserted] = await db
        .insert(vehicleFitments)
        .values(fitmentRecord)
        .returning({ id: vehicleFitments.id });
      fitmentId = inserted.id;
      action = "created";
    }
    
    return { success: true, action, fitmentId, sourceRecordId };
  } catch (error: any) {
    console.error("[importWheelSizeFitment] Error:", error?.message);
    return { success: false, action: "error", error: error?.message };
  }
}

// ============================================================================
// Batch Import Jobs
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
    if (progress.status === "running" && !updates.startedAt) {
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

// ============================================================================
// Import from Wheel-Size API (for batch operations)
// ============================================================================

const WHEELSIZE_API_BASE = "https://api.wheel-size.com/v2/";

interface WheelSizeImportOptions {
  yearStart: number;
  yearEnd: number;
  makes?: string[];
  apiKey: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Import all fitments for a year range from Wheel-Size
 * This is for batch import jobs, not for runtime API calls
 */
export async function importFromWheelSize(
  jobId: string,
  options: WheelSizeImportOptions
): Promise<void> {
  // HARD BLOCK: Wheel-Size API is forbidden in DB-first runtime
  console.error("[importFitment] Wheel-Size API FORBIDDEN - DB-first architecture");
  await updateImportJobProgress(jobId, { 
    status: "failed",
    lastError: "Wheel-Size API is forbidden in DB-first architecture"
  });
  throw new Error("Wheel-Size API is FORBIDDEN in DB-first runtime. Use bulk-import scripts for data seeding.");

  const { yearStart, yearEnd, makes, apiKey, onProgress } = options;
  
  await updateImportJobProgress(jobId, { status: "running" });
  
  let totalProcessed = 0;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  
  try {
    // Get list of makes
    const makesToProcess = makes || await fetchWheelSizeMakes(apiKey);
    
    for (let year = yearStart; year <= yearEnd; year++) {
      for (const make of makesToProcess) {
        try {
          // Get models for this year/make
          const models = await fetchWheelSizeModels(apiKey, year, make);
          
          for (const model of models) {
            try {
              // Get modifications for this year/make/model
              const modifications = await fetchWheelSizeModifications(apiKey, year, make, model);
              
              for (const mod of modifications) {
                totalProcessed++;
                
                const result = await importWheelSizeFitment(
                  year,
                  make,
                  model,
                  mod,
                  undefined, // wheelData - would need separate API call
                  undefined, // tireData - would need separate API call
                  mod // fullPayload
                );
                
                if (result.action === "created" || result.action === "updated") {
                  totalImported++;
                } else if (result.action === "skipped") {
                  totalSkipped++;
                } else {
                  totalErrors++;
                }
                
                // Update progress every 100 records
                if (totalProcessed % 100 === 0) {
                  await updateImportJobProgress(jobId, {
                    processedRecords: totalProcessed,
                    importedRecords: totalImported,
                    skippedRecords: totalSkipped,
                    errorCount: totalErrors,
                  });
                  onProgress?.(totalProcessed, 0); // Total unknown in streaming mode
                }
              }
            } catch (modelErr: any) {
              console.error(`[import] Error processing ${year} ${make} ${model}:`, modelErr?.message);
              totalErrors++;
            }
          }
        } catch (makeErr: any) {
          console.error(`[import] Error processing ${year} ${make}:`, makeErr?.message);
          totalErrors++;
        }
      }
    }
    
    await updateImportJobProgress(jobId, {
      status: "completed",
      processedRecords: totalProcessed,
      importedRecords: totalImported,
      skippedRecords: totalSkipped,
      errorCount: totalErrors,
    });
  } catch (error: any) {
    await updateImportJobProgress(jobId, {
      status: "failed",
      lastError: error?.message,
      processedRecords: totalProcessed,
      importedRecords: totalImported,
      skippedRecords: totalSkipped,
      errorCount: totalErrors,
    });
    throw error;
  }
}

// ============================================================================
// Wheel-Size API Helpers
// ============================================================================

async function fetchWheelSizeMakes(apiKey: string): Promise<string[]> {
  const url = new URL("makes/", WHEELSIZE_API_BASE);
  url.searchParams.set("user_key", apiKey);
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Wheel-Size makes API failed: ${res.status}`);
  
  const data = await res.json();
  return (data?.data || []).map((m: any) => m.slug || m.name);
}

async function fetchWheelSizeModels(apiKey: string, year: number, make: string): Promise<string[]> {
  const url = new URL("models/", WHEELSIZE_API_BASE);
  url.searchParams.set("user_key", apiKey);
  url.searchParams.set("make", make);
  url.searchParams.set("year", String(year));
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Wheel-Size models API failed: ${res.status}`);
  
  const data = await res.json();
  return (data?.data || []).map((m: any) => m.slug || m.name);
}

async function fetchWheelSizeModifications(
  apiKey: string,
  year: number,
  make: string,
  model: string
): Promise<any[]> {
  const url = new URL("modifications/", WHEELSIZE_API_BASE);
  url.searchParams.set("user_key", apiKey);
  url.searchParams.set("make", make);
  url.searchParams.set("model", model);
  url.searchParams.set("year", String(year));
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Wheel-Size modifications API failed: ${res.status}`);
  
  const data = await res.json();
  return data?.data || [];
}
