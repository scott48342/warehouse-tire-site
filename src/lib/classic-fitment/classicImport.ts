/**
 * Classic Fitment Import Service
 * 
 * Safe import of classic vehicle fitment data.
 * Includes validation and surgical rollback support.
 */

import { db } from "../fitment-db/db";
import { classicFitments } from "./schema";
import { eq, and } from "drizzle-orm";
import type {
  ClassicFitmentInput,
  ClassicImportResult,
  ClassicBatchImportResult,
  ClassicValidationResult,
} from "./types";

// ============================================================================
// Validation
// ============================================================================

const VALID_BOLT_PATTERNS = new Set([
  "4x100",
  "4x108",
  "4x114.3",
  "5x100",
  "5x108",
  "5x110",
  "5x112",
  "5x114.3",
  "5x115",
  "5x120",
  "5x120.65", // 5x4.75" (GM)
  "5x127",    // 5x5" (Jeep/GM)
  "5x139.7",  // 5x5.5"
  "6x114.3",
  "6x127",
  "6x139.7",
]);

const VALID_THREAD_SIZES = new Set([
  "7/16-20",   // GM classic
  "1/2-20",    // Ford/Mopar classic
  "12x1.5",
  "12x1.25",
  "14x1.5",
  "14x2.0",
  "M12x1.5",
  "M12x1.25",
  "M14x1.5",
]);

export function validateClassicRecord(input: ClassicFitmentInput): ClassicValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!input.platformCode) errors.push("Missing platformCode");
  if (!input.platformName) errors.push("Missing platformName");
  if (!input.make) errors.push("Missing make");
  if (!input.model) errors.push("Missing model");
  if (!input.yearStart) errors.push("Missing yearStart");
  if (!input.yearEnd) errors.push("Missing yearEnd");
  if (!input.commonBoltPattern) errors.push("Missing commonBoltPattern");
  if (!input.confidence) errors.push("Missing confidence");

  // Bolt pattern validation
  if (input.commonBoltPattern && !VALID_BOLT_PATTERNS.has(input.commonBoltPattern)) {
    errors.push(`Invalid bolt pattern: ${input.commonBoltPattern}`);
  }

  // Thread size validation (if provided)
  if (input.commonThreadSize && !VALID_THREAD_SIZES.has(input.commonThreadSize)) {
    warnings.push(`Unusual thread size: ${input.commonThreadSize}`);
  }

  // Year range validation
  if (input.yearStart && input.yearEnd && input.yearStart > input.yearEnd) {
    errors.push(`Invalid year range: ${input.yearStart}-${input.yearEnd}`);
  }

  // Wheel range validation
  if (input.recWheelDiameterMin && input.recWheelDiameterMax) {
    if (input.recWheelDiameterMin > input.recWheelDiameterMax) {
      errors.push("Invalid wheel diameter range");
    }
    if (input.recWheelDiameterMin < 13 || input.recWheelDiameterMax > 22) {
      warnings.push("Unusual wheel diameter range for classic vehicle");
    }
  }

  if (input.recWheelWidthMin && input.recWheelWidthMax) {
    if (input.recWheelWidthMin > input.recWheelWidthMax) {
      errors.push("Invalid wheel width range");
    }
  }

  if (input.recOffsetMinMm !== undefined && input.recOffsetMaxMm !== undefined) {
    if (input.recOffsetMinMm > input.recOffsetMaxMm) {
      errors.push("Invalid offset range");
    }
  }

  // Confidence validation
  if (input.confidence && !["high", "medium", "low"].includes(input.confidence)) {
    errors.push(`Invalid confidence: ${input.confidence}`);
  }

  // Center bore sanity check
  if (input.commonCenterBore) {
    if (input.commonCenterBore < 50 || input.commonCenterBore > 130) {
      warnings.push(`Unusual center bore: ${input.commonCenterBore}mm`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import a single classic fitment record
 */
export async function importClassicFitment(
  input: ClassicFitmentInput,
  batchTag: string
): Promise<ClassicImportResult> {
  // Validate
  const validation = validateClassicRecord(input);
  if (!validation.valid) {
    return {
      success: false,
      action: "error",
      error: validation.errors.join("; "),
    };
  }

  const normalizedMake = input.make.toLowerCase().trim();
  const normalizedModel = input.model.toLowerCase().trim().replace(/\s+/g, "-");

  try {
    // Check if exists (by platform + make + model)
    const [existing] = await db
      .select()
      .from(classicFitments)
      .where(
        and(
          eq(classicFitments.platformCode, input.platformCode),
          eq(classicFitments.make, normalizedMake),
          eq(classicFitments.model, normalizedModel)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing record
      await db
        .update(classicFitments)
        .set({
          platformName: input.platformName,
          generationName: input.generationName || null,
          yearStart: input.yearStart,
          yearEnd: input.yearEnd,
          fitmentSource: "classic-platform-baseline",
          fitmentStyle: input.fitmentStyle || "stock_baseline",
          confidence: input.confidence,
          verificationNote: input.verificationNote || null,
          requiresClearanceCheck: input.requiresClearanceCheck ?? true,
          commonModifications: input.commonModifications || [],
          commonBoltPattern: input.commonBoltPattern,
          commonCenterBore: input.commonCenterBore ? String(input.commonCenterBore) : null,
          commonThreadSize: input.commonThreadSize || null,
          commonSeatType: input.commonSeatType || null,
          recWheelDiameterMin: input.recWheelDiameterMin || null,
          recWheelDiameterMax: input.recWheelDiameterMax || null,
          recWheelWidthMin: input.recWheelWidthMin ? String(input.recWheelWidthMin) : null,
          recWheelWidthMax: input.recWheelWidthMax ? String(input.recWheelWidthMax) : null,
          recOffsetMinMm: input.recOffsetMinMm ?? null,
          recOffsetMaxMm: input.recOffsetMaxMm ?? null,
          stockWheelDiameter: input.stockWheelDiameter || null,
          stockWheelWidth: input.stockWheelWidth ? String(input.stockWheelWidth) : null,
          stockTireSize: input.stockTireSize || null,
          modificationRisk: input.modificationRisk || "medium",
          batchTag,
          version: existing.version + 1,
          isActive: true,
          notes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(classicFitments.id, existing.id));

      return {
        success: true,
        action: "updated",
        id: existing.id,
      };
    }

    // Insert new record
    const [inserted] = await db
      .insert(classicFitments)
      .values({
        platformCode: input.platformCode,
        platformName: input.platformName,
        generationName: input.generationName || null,
        make: normalizedMake,
        model: normalizedModel,
        yearStart: input.yearStart,
        yearEnd: input.yearEnd,
        fitmentLevel: "classic-platform",
        fitmentSource: "classic-platform-baseline",
        fitmentStyle: input.fitmentStyle || "stock_baseline",
        confidence: input.confidence,
        verificationNote: input.verificationNote || null,
        requiresClearanceCheck: input.requiresClearanceCheck ?? true,
        commonModifications: input.commonModifications || [],
        commonBoltPattern: input.commonBoltPattern,
        commonCenterBore: input.commonCenterBore ? String(input.commonCenterBore) : null,
        commonThreadSize: input.commonThreadSize || null,
        commonSeatType: input.commonSeatType || null,
        recWheelDiameterMin: input.recWheelDiameterMin || null,
        recWheelDiameterMax: input.recWheelDiameterMax || null,
        recWheelWidthMin: input.recWheelWidthMin ? String(input.recWheelWidthMin) : null,
        recWheelWidthMax: input.recWheelWidthMax ? String(input.recWheelWidthMax) : null,
        recOffsetMinMm: input.recOffsetMinMm ?? null,
        recOffsetMaxMm: input.recOffsetMaxMm ?? null,
        stockWheelDiameter: input.stockWheelDiameter || null,
        stockWheelWidth: input.stockWheelWidth ? String(input.stockWheelWidth) : null,
        stockTireSize: input.stockTireSize || null,
        modificationRisk: input.modificationRisk || "medium",
        batchTag,
        version: 1,
        isActive: true,
        notes: input.notes || null,
      })
      .returning({ id: classicFitments.id });

    return {
      success: true,
      action: "created",
      id: inserted.id,
    };
  } catch (err: any) {
    console.error("[classicImport] Error:", err?.message);
    return {
      success: false,
      action: "error",
      error: err?.message || String(err),
    };
  }
}

/**
 * Import a batch of classic fitment records
 */
export async function importClassicBatch(
  records: ClassicFitmentInput[],
  batchTag: string
): Promise<ClassicBatchImportResult> {
  const result: ClassicBatchImportResult = {
    batchTag,
    totalRecords: records.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const record of records) {
    const importResult = await importClassicFitment(record, batchTag);

    if (importResult.success) {
      if (importResult.action === "created") result.created++;
      else if (importResult.action === "updated") result.updated++;
      else if (importResult.action === "skipped") result.skipped++;
    } else {
      result.errors.push(
        `${record.make} ${record.model}: ${importResult.error}`
      );
    }
  }

  console.log(
    `[classicImport] Batch ${batchTag}: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`
  );

  return result;
}
