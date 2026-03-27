/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MANUAL FITMENT IMPORT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Import fitment data from CSV/JSON without Wheel-Size API dependency.
 * 
 * Data sources:
 * - CSV/JSON files from dealer fitment guides
 * - Manufacturer spec sheets
 * - Industry databases (ACES/PIES)
 * - Manual research
 * 
 * Features:
 * - Validation and normalization
 * - Idempotent upserts
 * - Provenance tracking
 * - Stable internal IDs
 * 
 * @created 2026-03-27
 */

import { db, schema } from "./db";
import { eq, and, sql } from "drizzle-orm";
import * as crypto from "crypto";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Raw input format for fitment data (from CSV/JSON)
 */
export interface FitmentInput {
  // Required vehicle identity
  year: number | string;
  make: string;
  model: string;
  
  // Trim identification (at least one required)
  trim?: string;           // e.g., "XLT", "Lariat", "Base"
  displayTrim?: string;    // Customer-facing name
  submodel?: string;       // e.g., "SuperCrew", "Regular Cab"
  
  // Wheel specifications (required)
  boltPattern: string;     // e.g., "6x135", "5x114.3"
  centerBoreMm: number | string;
  
  // Lug hardware
  threadSize?: string;     // e.g., "M14x1.5", "14x1.5"
  seatType?: string;       // conical, ball, flat, mag
  
  // Wheel size ranges (optional but recommended)
  wheelDiameterMin?: number | string;
  wheelDiameterMax?: number | string;
  wheelWidthMin?: number | string;
  wheelWidthMax?: number | string;
  
  // Offset range
  offsetMinMm?: number | string;
  offsetMaxMm?: number | string;
  
  // OEM specs (optional)
  oemWheelSizes?: string[] | string;  // ["17x7", "18x8"] or CSV
  oemTireSizes?: string[] | string;   // ["265/70R17", "275/65R18"] or CSV
  
  // Provenance (required for audit trail)
  source: string;          // "manual", "csv_import", "dealer_guide", etc.
  sourceNotes?: string;    // Additional context
  confidence?: "high" | "medium" | "low";
  
  // Optional override for modification ID (otherwise auto-generated)
  modificationId?: string;
}

/**
 * Normalized fitment record ready for database
 */
export interface NormalizedFitment {
  year: number;
  make: string;
  model: string;
  modificationId: string;
  rawTrim: string | null;
  displayTrim: string;
  submodel: string | null;
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string | null;
  seatType: string | null;
  wheelDiameterMin: number | null;
  wheelDiameterMax: number | null;
  wheelWidthMin: number | null;
  wheelWidthMax: number | null;
  offsetMinMm: number | null;
  offsetMaxMm: number | null;
  oemWheelSizes: any[];
  oemTireSizes: any[];
  source: string;
  sourceNotes: string | null;
  confidence: string;
}

/**
 * Import result for a single record
 */
export interface ImportRecordResult {
  success: boolean;
  action: "inserted" | "updated" | "skipped" | "failed";
  vehicle: string;
  modificationId?: string;
  error?: string;
}

/**
 * Bulk import result
 */
export interface BulkImportResult {
  success: boolean;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; vehicle: string; error: string }>;
  results: ImportRecordResult[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION & NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate and normalize a bolt pattern string
 */
export function normalizeBoltPattern(input: string): string | null {
  if (!input) return null;
  
  let bp = String(input).trim().toLowerCase();
  
  // Common formats: "6x135", "6×135", "6-135", "6x135mm"
  bp = bp.replace(/×/g, "x").replace(/-/g, "x").replace(/mm$/i, "");
  
  // Validate format: NxNNN or NxNNN.N
  const match = bp.match(/^(\d+)x(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  
  const lugs = parseInt(match[1], 10);
  const pcd = parseFloat(match[2]);
  
  if (lugs < 3 || lugs > 10) return null;
  if (pcd < 50 || pcd > 250) return null;
  
  return `${lugs}x${pcd}`;
}

/**
 * Normalize center bore to number
 */
export function normalizeCenterBore(input: number | string): number | null {
  if (input === null || input === undefined || input === "") return null;
  
  const num = typeof input === "number" ? input : parseFloat(String(input).replace(/mm$/i, ""));
  
  if (isNaN(num) || num < 30 || num > 150) return null;
  
  return Math.round(num * 10) / 10; // 1 decimal place
}

/**
 * Normalize thread size
 */
export function normalizeThreadSize(input: string | undefined): string | null {
  if (!input) return null;
  
  let ts = String(input).trim().toUpperCase();
  
  // Add M prefix if missing for metric threads
  if (/^\d+[Xx]\d/.test(ts)) {
    ts = "M" + ts;
  }
  
  // Normalize separators
  ts = ts.replace(/[Xx×]/g, "x");
  
  // Common formats: M14x1.5, M12x1.25, M12x1.5
  if (!/^M\d+x\d+(\.\d+)?$/.test(ts)) {
    // Try imperial format: 1/2-20
    if (/^\d+\/\d+-\d+$/.test(ts)) {
      return ts;
    }
    return null;
  }
  
  return ts;
}

/**
 * Normalize seat type
 */
export function normalizeSeatType(input: string | undefined): string | null {
  if (!input) return null;
  
  const st = String(input).trim().toLowerCase();
  
  const mapping: Record<string, string> = {
    "conical": "conical",
    "cone": "conical",
    "tapered": "conical",
    "60 degree": "conical",
    "ball": "ball",
    "spherical": "ball",
    "flat": "flat",
    "washer": "flat",
    "mag": "mag",
    "shank": "mag",
  };
  
  return mapping[st] || null;
}

/**
 * Parse numeric value with validation
 */
function parseNumeric(input: number | string | undefined, min?: number, max?: number): number | null {
  if (input === null || input === undefined || input === "") return null;
  
  const num = typeof input === "number" ? input : parseFloat(String(input));
  
  if (isNaN(num)) return null;
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  
  return num;
}

/**
 * Normalize make name for storage (lowercase, trimmed)
 */
export function normalizeMake(input: string): string {
  return String(input).trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Normalize model name for storage
 */
export function normalizeModel(input: string): string {
  return String(input).trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Generate stable modification ID from vehicle + trim data
 */
export function generateModificationId(
  year: number,
  make: string,
  model: string,
  trim?: string,
  submodel?: string
): string {
  // Create a stable hash from the identifying fields
  const key = [
    year,
    normalizeMake(make),
    normalizeModel(model),
    (trim || "base").toLowerCase().trim(),
    (submodel || "").toLowerCase().trim(),
  ].join("|");
  
  // Use SHA256 and take first 12 chars for a reasonably unique ID
  const hash = crypto.createHash("sha256").update(key).digest("hex").slice(0, 12);
  
  return `manual_${hash}`;
}

/**
 * Parse OEM sizes from string or array
 */
function parseOemSizes(input: string[] | string | undefined): string[] {
  if (!input) return [];
  
  if (Array.isArray(input)) {
    return input.map(s => String(s).trim()).filter(Boolean);
  }
  
  // Parse CSV string
  return String(input)
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Create display trim from trim + submodel
 */
function createDisplayTrim(trim?: string, submodel?: string): string {
  const parts = [trim, submodel].filter(Boolean).map(s => s!.trim());
  return parts.length > 0 ? parts.join(" ") : "Base";
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validate a fitment input record
 */
export function validateFitmentInput(input: FitmentInput): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Required fields
  if (!input.year) {
    errors.push({ field: "year", message: "Year is required" });
  } else {
    const year = typeof input.year === "number" ? input.year : parseInt(String(input.year), 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      errors.push({ field: "year", message: "Invalid year", value: input.year });
    }
  }
  
  if (!input.make?.trim()) {
    errors.push({ field: "make", message: "Make is required" });
  }
  
  if (!input.model?.trim()) {
    errors.push({ field: "model", message: "Model is required" });
  }
  
  if (!input.boltPattern) {
    errors.push({ field: "boltPattern", message: "Bolt pattern is required" });
  } else if (!normalizeBoltPattern(input.boltPattern)) {
    errors.push({ field: "boltPattern", message: "Invalid bolt pattern format", value: input.boltPattern });
  }
  
  if (input.centerBoreMm === undefined || input.centerBoreMm === null || input.centerBoreMm === "") {
    errors.push({ field: "centerBoreMm", message: "Center bore is required" });
  } else if (normalizeCenterBore(input.centerBoreMm) === null) {
    errors.push({ field: "centerBoreMm", message: "Invalid center bore (must be 30-150mm)", value: input.centerBoreMm });
  }
  
  if (!input.source?.trim()) {
    errors.push({ field: "source", message: "Source is required for audit trail" });
  }
  
  // Optional field validation
  if (input.threadSize && !normalizeThreadSize(input.threadSize)) {
    errors.push({ field: "threadSize", message: "Invalid thread size format", value: input.threadSize });
  }
  
  if (input.seatType && !normalizeSeatType(input.seatType)) {
    errors.push({ field: "seatType", message: "Invalid seat type", value: input.seatType });
  }
  
  // Range validations
  if (input.wheelDiameterMin !== undefined && input.wheelDiameterMax !== undefined) {
    const min = parseNumeric(input.wheelDiameterMin);
    const max = parseNumeric(input.wheelDiameterMax);
    if (min !== null && max !== null && min > max) {
      errors.push({ field: "wheelDiameter", message: "Min diameter cannot exceed max" });
    }
  }
  
  if (input.wheelWidthMin !== undefined && input.wheelWidthMax !== undefined) {
    const min = parseNumeric(input.wheelWidthMin);
    const max = parseNumeric(input.wheelWidthMax);
    if (min !== null && max !== null && min > max) {
      errors.push({ field: "wheelWidth", message: "Min width cannot exceed max" });
    }
  }
  
  if (input.offsetMinMm !== undefined && input.offsetMaxMm !== undefined) {
    const min = parseNumeric(input.offsetMinMm);
    const max = parseNumeric(input.offsetMaxMm);
    if (min !== null && max !== null && min > max) {
      errors.push({ field: "offset", message: "Min offset cannot exceed max" });
    }
  }
  
  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a fitment input into database format
 */
export function normalizeFitmentInput(input: FitmentInput): NormalizedFitment {
  const year = typeof input.year === "number" ? input.year : parseInt(String(input.year), 10);
  const make = normalizeMake(input.make);
  const model = normalizeModel(input.model);
  
  const modificationId = input.modificationId || generateModificationId(
    year,
    make,
    model,
    input.trim,
    input.submodel
  );
  
  return {
    year,
    make,
    model,
    modificationId,
    rawTrim: input.trim || null,
    displayTrim: input.displayTrim || createDisplayTrim(input.trim, input.submodel),
    submodel: input.submodel || null,
    boltPattern: normalizeBoltPattern(input.boltPattern)!,
    centerBoreMm: normalizeCenterBore(input.centerBoreMm)!,
    threadSize: normalizeThreadSize(input.threadSize),
    seatType: normalizeSeatType(input.seatType),
    wheelDiameterMin: parseNumeric(input.wheelDiameterMin, 10, 30),
    wheelDiameterMax: parseNumeric(input.wheelDiameterMax, 10, 30),
    wheelWidthMin: parseNumeric(input.wheelWidthMin, 3, 20),
    wheelWidthMax: parseNumeric(input.wheelWidthMax, 3, 20),
    offsetMinMm: parseNumeric(input.offsetMinMm, -100, 100),
    offsetMaxMm: parseNumeric(input.offsetMaxMm, -100, 100),
    oemWheelSizes: parseOemSizes(input.oemWheelSizes),
    oemTireSizes: parseOemSizes(input.oemTireSizes),
    source: input.source.trim(),
    sourceNotes: input.sourceNotes?.trim() || null,
    confidence: input.confidence || "medium",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upsert a single fitment record (idempotent)
 */
export async function upsertFitment(
  input: FitmentInput,
  options: { skipValidation?: boolean } = {}
): Promise<ImportRecordResult> {
  const vehicleLabel = `${input.year} ${input.make} ${input.model}`;
  
  // Validate
  if (!options.skipValidation) {
    const errors = validateFitmentInput(input);
    if (errors.length > 0) {
      return {
        success: false,
        action: "failed",
        vehicle: vehicleLabel,
        error: errors.map(e => `${e.field}: ${e.message}`).join("; "),
      };
    }
  }
  
  // Normalize
  const normalized = normalizeFitmentInput(input);
  
  try {
    // Check if record exists
    const existing = await db
      .select({ id: schema.vehicleFitments.id })
      .from(schema.vehicleFitments)
      .where(
        and(
          eq(schema.vehicleFitments.year, normalized.year),
          eq(schema.vehicleFitments.make, normalized.make),
          eq(schema.vehicleFitments.model, normalized.model),
          eq(schema.vehicleFitments.modificationId, normalized.modificationId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      await db
        .update(schema.vehicleFitments)
        .set({
          rawTrim: normalized.rawTrim,
          displayTrim: normalized.displayTrim,
          submodel: normalized.submodel,
          boltPattern: normalized.boltPattern,
          centerBoreMm: String(normalized.centerBoreMm),
          threadSize: normalized.threadSize,
          seatType: normalized.seatType,
          offsetMinMm: normalized.offsetMinMm !== null ? String(normalized.offsetMinMm) : null,
          offsetMaxMm: normalized.offsetMaxMm !== null ? String(normalized.offsetMaxMm) : null,
          oemWheelSizes: normalized.oemWheelSizes,
          oemTireSizes: normalized.oemTireSizes,
          source: normalized.source,
          updatedAt: new Date(),
        })
        .where(eq(schema.vehicleFitments.id, existing[0].id));
      
      return {
        success: true,
        action: "updated",
        vehicle: vehicleLabel,
        modificationId: normalized.modificationId,
      };
    } else {
      // Insert new record
      await db.insert(schema.vehicleFitments).values({
        year: normalized.year,
        make: normalized.make,
        model: normalized.model,
        modificationId: normalized.modificationId,
        rawTrim: normalized.rawTrim,
        displayTrim: normalized.displayTrim,
        submodel: normalized.submodel,
        boltPattern: normalized.boltPattern,
        centerBoreMm: String(normalized.centerBoreMm),
        threadSize: normalized.threadSize,
        seatType: normalized.seatType,
        offsetMinMm: normalized.offsetMinMm !== null ? String(normalized.offsetMinMm) : null,
        offsetMaxMm: normalized.offsetMaxMm !== null ? String(normalized.offsetMaxMm) : null,
        oemWheelSizes: normalized.oemWheelSizes,
        oemTireSizes: normalized.oemTireSizes,
        source: normalized.source,
      });
      
      return {
        success: true,
        action: "inserted",
        vehicle: vehicleLabel,
        modificationId: normalized.modificationId,
      };
    }
  } catch (err) {
    return {
      success: false,
      action: "failed",
      vehicle: vehicleLabel,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Import multiple fitment records from JSON array
 */
export async function importFromJson(
  records: FitmentInput[],
  options: {
    stopOnError?: boolean;
    validateOnly?: boolean;
  } = {}
): Promise<BulkImportResult> {
  const results: ImportRecordResult[] = [];
  const errors: Array<{ row: number; vehicle: string; error: string }> = [];
  
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const vehicleLabel = `${record.year} ${record.make} ${record.model}`;
    
    // Validate
    const validationErrors = validateFitmentInput(record);
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.map(e => `${e.field}: ${e.message}`).join("; ");
      errors.push({ row: i + 1, vehicle: vehicleLabel, error: errorMsg });
      results.push({ success: false, action: "failed", vehicle: vehicleLabel, error: errorMsg });
      failed++;
      
      if (options.stopOnError) break;
      continue;
    }
    
    if (options.validateOnly) {
      results.push({ success: true, action: "skipped", vehicle: vehicleLabel });
      skipped++;
      continue;
    }
    
    // Upsert
    const result = await upsertFitment(record, { skipValidation: true });
    results.push(result);
    
    if (result.success) {
      if (result.action === "inserted") inserted++;
      else if (result.action === "updated") updated++;
      else skipped++;
    } else {
      failed++;
      errors.push({ row: i + 1, vehicle: vehicleLabel, error: result.error || "Unknown error" });
      if (options.stopOnError) break;
    }
  }
  
  return {
    success: failed === 0,
    total: records.length,
    inserted,
    updated,
    skipped,
    failed,
    errors,
    results,
  };
}

/**
 * Parse CSV content into FitmentInput records
 */
export function parseCsv(csvContent: string): FitmentInput[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];
  
  // Find header (skip comment lines at the start)
  let headerIdx = 0;
  while (headerIdx < lines.length && lines[headerIdx].trim().startsWith("#")) {
    headerIdx++;
  }
  if (headerIdx >= lines.length) return [];
  
  // Parse header
  const header = lines[headerIdx].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  
  // Map common header variations
  const headerMapping: Record<string, string> = {
    "year": "year",
    "make": "make",
    "model": "model",
    "trim": "trim",
    "display_trim": "displayTrim",
    "displaytrim": "displayTrim",
    "submodel": "submodel",
    "bolt_pattern": "boltPattern",
    "boltpattern": "boltPattern",
    "bolt": "boltPattern",
    "center_bore": "centerBoreMm",
    "centerbore": "centerBoreMm",
    "center_bore_mm": "centerBoreMm",
    "hub_bore": "centerBoreMm",
    "thread_size": "threadSize",
    "threadsize": "threadSize",
    "lug_thread": "threadSize",
    "seat_type": "seatType",
    "seattype": "seatType",
    "wheel_diameter_min": "wheelDiameterMin",
    "wheel_diameter_max": "wheelDiameterMax",
    "diameter_min": "wheelDiameterMin",
    "diameter_max": "wheelDiameterMax",
    "wheel_width_min": "wheelWidthMin",
    "wheel_width_max": "wheelWidthMax",
    "width_min": "wheelWidthMin",
    "width_max": "wheelWidthMax",
    "offset_min": "offsetMinMm",
    "offset_max": "offsetMaxMm",
    "offset_min_mm": "offsetMinMm",
    "offset_max_mm": "offsetMaxMm",
    "oem_wheel_sizes": "oemWheelSizes",
    "oem_tire_sizes": "oemTireSizes",
    "source": "source",
    "source_notes": "sourceNotes",
    "confidence": "confidence",
    "modification_id": "modificationId",
  };
  
  const mappedHeader = header.map(h => headerMapping[h] || h);
  
  // Parse rows
  const records: FitmentInput[] = [];
  
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue; // Skip empty lines and comments
    
    // Simple CSV parsing (doesn't handle quoted commas)
    const values = line.split(",").map(v => v.trim());
    
    const record: any = {};
    for (let j = 0; j < mappedHeader.length && j < values.length; j++) {
      const key = mappedHeader[j];
      const value = values[j];
      if (value) record[key] = value;
    }
    
    // Default source if not provided
    if (!record.source) record.source = "csv_import";
    
    records.push(record as FitmentInput);
  }
  
  return records;
}

/**
 * Import fitment data from CSV string
 */
export async function importFromCsv(
  csvContent: string,
  options: {
    stopOnError?: boolean;
    validateOnly?: boolean;
    defaultSource?: string;
  } = {}
): Promise<BulkImportResult> {
  const records = parseCsv(csvContent);
  
  // Apply default source
  if (options.defaultSource) {
    for (const r of records) {
      if (!r.source) r.source = options.defaultSource;
    }
  }
  
  return importFromJson(records, options);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXAMPLE DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate example CSV format
 */
export function getExampleCsv(): string {
  return `year,make,model,trim,bolt_pattern,center_bore_mm,thread_size,seat_type,offset_min_mm,offset_max_mm,source,confidence
2024,Ford,F-150,XLT,6x135,87.1,M14x1.5,conical,-12,44,dealer_guide,high
2024,Ford,F-150,Lariat,6x135,87.1,M14x1.5,conical,-12,44,dealer_guide,high
2024,Chevrolet,Silverado 1500,LT,6x139.7,78.1,M14x1.5,conical,0,31,dealer_guide,high
2024,RAM,Ram 1500,Big Horn,6x139.7,77.8,M14x1.5,conical,-12,25,dealer_guide,high
`;
}

/**
 * Generate example JSON format
 */
export function getExampleJson(): FitmentInput[] {
  return [
    {
      year: 2024,
      make: "Ford",
      model: "F-150",
      trim: "XLT",
      boltPattern: "6x135",
      centerBoreMm: 87.1,
      threadSize: "M14x1.5",
      seatType: "conical",
      offsetMinMm: -12,
      offsetMaxMm: 44,
      oemWheelSizes: ["17x7.5", "18x8.5", "20x8.5"],
      oemTireSizes: ["265/70R17", "275/65R18", "275/55R20"],
      source: "dealer_guide",
      sourceNotes: "From Ford dealer fitment guide 2024",
      confidence: "high",
    },
    {
      year: 2024,
      make: "Chevrolet",
      model: "Silverado 1500",
      trim: "LT",
      boltPattern: "6x139.7",
      centerBoreMm: 78.1,
      threadSize: "M14x1.5",
      seatType: "conical",
      offsetMinMm: 0,
      offsetMaxMm: 31,
      source: "dealer_guide",
      confidence: "high",
    },
  ];
}
