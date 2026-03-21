/**
 * Fitment Data Normalization
 * 
 * Transforms raw API responses into normalized fitment records.
 * Each source (Wheel-Size, WheelPros, etc.) has its own normalizer.
 */

import type { NewVehicleFitment, NewFitmentSourceRecord } from "./schema";
import type { OemWheelSize, OemTireSize } from "./types";
import { normalizeMake, normalizeModel, makePayloadChecksum, slugify } from "./keys";
import { normalizeTrimLabel } from "../trimNormalize";

// ============================================================================
// Wheel-Size API Normalizer
// ============================================================================

interface WheelSizeModification {
  slug: string;
  name?: string;
  trim?: string | { name?: string };
  engine?: string | { capacity?: string; type?: string };
  body?: string;
  generation?: { name?: string };
  regions?: string[];
}

interface WheelSizeWheelData {
  front?: {
    rim_diameter?: number;
    rim_width?: number;
    offset?: number;
    bolt_pattern?: string;
    center_bore?: number;
  };
  rear?: {
    rim_diameter?: number;
    rim_width?: number;
    offset?: number;
  };
  lock_type?: string;
  lock_text?: string;
  bolt_pattern?: string;
  center_bore?: number;
  pcd?: number;
  pcd_mm?: number;
  stud_holes?: number;
}

interface WheelSizeTireData {
  front?: {
    tire_width?: number;
    aspect_ratio?: number;
    rim_diameter?: number;
  };
  rear?: {
    tire_width?: number;
    aspect_ratio?: number;
    rim_diameter?: number;
  };
}

interface WheelSizePayload {
  data?: WheelSizeModification[];
  modifications?: WheelSizeModification[];
  wheels?: WheelSizeWheelData[];
  tires?: WheelSizeTireData[];
}

/**
 * Safely extract string from potentially nested object
 */
function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name.trim();
    if (typeof obj.value === "string") return obj.value.trim();
    if (typeof obj.capacity === "string") return obj.capacity.trim();
    if (typeof obj.type === "string") return obj.type.trim();
  }
  return "";
}

/**
 * Parse bolt pattern from various formats
 */
function parseBoltPattern(data: WheelSizeWheelData): string | null {
  // Try direct bolt_pattern field
  if (data.bolt_pattern) return data.bolt_pattern;
  
  // Try to construct from stud_holes and pcd
  if (data.stud_holes && data.pcd_mm) {
    return `${data.stud_holes}x${data.pcd_mm}`;
  }
  
  // Try from front wheel data
  if (data.front?.bolt_pattern) return data.front.bolt_pattern;
  
  return null;
}

/**
 * Parse thread size from lock type/text
 */
function parseThreadSize(data: WheelSizeWheelData): string | null {
  const lockText = data.lock_text || "";
  
  // Common patterns: "M14x1.5", "M12x1.25", "14x1.5"
  const match = lockText.match(/M?(\d+)\s*x\s*([\d.]+)/i);
  if (match) {
    return `M${match[1]}x${match[2]}`;
  }
  
  return null;
}

/**
 * Normalize Wheel-Size API response to fitment record
 */
export function normalizeWheelSizeData(
  year: number,
  make: string,
  model: string,
  modification: WheelSizeModification,
  wheelData?: WheelSizeWheelData,
  tireData?: WheelSizeTireData
): Omit<NewVehicleFitment, "sourceRecordId"> {
  const trimStr = safeString(modification.trim);
  const engineStr = safeString(modification.engine);
  const nameStr = safeString(modification.name);
  
  // Use our trim normalizer to get display label
  const displayTrim = normalizeTrimLabel(trimStr, engineStr, nameStr, String(year), make, model) || "Base";
  
  // Parse wheel specifications
  const boltPattern = wheelData ? parseBoltPattern(wheelData) : null;
  const centerBore = wheelData?.center_bore ?? wheelData?.front?.rim_diameter ?? null;
  const threadSize = wheelData ? parseThreadSize(wheelData) : null;
  
  // Extract OEM wheel sizes
  const oemWheelSizes: OemWheelSize[] = [];
  if (wheelData?.front) {
    const f = wheelData.front;
    if (f.rim_diameter && f.rim_width) {
      oemWheelSizes.push({
        diameter: f.rim_diameter,
        width: f.rim_width,
        offset: f.offset ?? 0,
        is_front: true,
        is_rear: !wheelData.rear,
        is_staggered: !!wheelData.rear,
      });
    }
  }
  if (wheelData?.rear) {
    const r = wheelData.rear;
    if (r.rim_diameter && r.rim_width) {
      oemWheelSizes.push({
        diameter: r.rim_diameter,
        width: r.rim_width,
        offset: r.offset ?? 0,
        is_front: false,
        is_rear: true,
        is_staggered: true,
      });
    }
  }
  
  // Extract OEM tire sizes
  const oemTireSizes: OemTireSize[] = [];
  if (tireData?.front) {
    const f = tireData.front;
    if (f.tire_width && f.aspect_ratio && f.rim_diameter) {
      oemTireSizes.push({
        width: f.tire_width,
        aspect_ratio: f.aspect_ratio,
        diameter: f.rim_diameter,
        load_index: null,
        speed_rating: null,
        is_front: true,
        is_rear: !tireData.rear,
      });
    }
  }
  if (tireData?.rear) {
    const r = tireData.rear;
    if (r.tire_width && r.aspect_ratio && r.rim_diameter) {
      oemTireSizes.push({
        width: r.tire_width,
        aspect_ratio: r.aspect_ratio,
        diameter: r.rim_diameter,
        load_index: null,
        speed_rating: null,
        is_front: false,
        is_rear: true,
      });
    }
  }
  
  // Calculate offset range from OEM sizes
  const offsets = oemWheelSizes.map(w => w.offset).filter(o => o !== 0);
  const offsetMin = offsets.length > 0 ? Math.min(...offsets) - 10 : null;
  const offsetMax = offsets.length > 0 ? Math.max(...offsets) + 10 : null;
  
  return {
    year,
    make: normalizeMake(make),
    model: normalizeModel(model),
    modificationId: slugify(modification.slug),
    rawTrim: trimStr || engineStr || nameStr || null,
    displayTrim,
    submodel: null, // Could parse from body/generation
    boltPattern,
    centerBoreMm: centerBore ? String(centerBore) : null,
    threadSize,
    seatType: null, // Wheel-Size doesn't provide this
    offsetMinMm: offsetMin !== null ? String(offsetMin) : null,
    offsetMaxMm: offsetMax !== null ? String(offsetMax) : null,
    oemWheelSizes,
    oemTireSizes,
    source: "wheelsize",
    lastVerifiedAt: null,
  };
}

/**
 * Create source record from Wheel-Size API response
 */
export function createWheelSizeSourceRecord(
  year: number,
  make: string,
  model: string,
  sourceId: string,
  rawPayload: unknown
): NewFitmentSourceRecord {
  return {
    source: "wheelsize",
    sourceId,
    year,
    make: normalizeMake(make),
    model: normalizeModel(model),
    rawPayload: rawPayload as Record<string, unknown>,
    checksum: makePayloadChecksum(rawPayload),
  };
}

// ============================================================================
// WheelPros API Normalizer (placeholder for when API access is fixed)
// ============================================================================

export function normalizeWheelProsData(
  year: number,
  make: string,
  model: string,
  submodel: string,
  fitmentData: unknown
): Omit<NewVehicleFitment, "sourceRecordId"> {
  // TODO: Implement when WheelPros Vehicle API access is available
  const data = fitmentData as Record<string, unknown>;
  
  return {
    year,
    make: normalizeMake(make),
    model: normalizeModel(model),
    modificationId: slugify(submodel),
    rawTrim: submodel,
    displayTrim: submodel,
    submodel: null,
    boltPattern: null,
    centerBoreMm: null,
    threadSize: null,
    seatType: null,
    offsetMinMm: null,
    offsetMaxMm: null,
    oemWheelSizes: [],
    oemTireSizes: [],
    source: "wheelpros",
    lastVerifiedAt: null,
  };
}

// ============================================================================
// Manual/Import Normalizer
// ============================================================================

export interface ManualFitmentInput {
  year: number;
  make: string;
  model: string;
  modificationId: string;
  displayTrim: string;
  rawTrim?: string;
  submodel?: string;
  boltPattern?: string;
  centerBoreMm?: number;
  threadSize?: string;
  seatType?: string;
  offsetMinMm?: number;
  offsetMaxMm?: number;
  oemWheelSizes?: OemWheelSize[];
  oemTireSizes?: OemTireSize[];
}

export function normalizeManualFitment(
  input: ManualFitmentInput
): Omit<NewVehicleFitment, "sourceRecordId"> {
  return {
    year: input.year,
    make: normalizeMake(input.make),
    model: normalizeModel(input.model),
    modificationId: slugify(input.modificationId),
    rawTrim: input.rawTrim ?? null,
    displayTrim: input.displayTrim,
    submodel: input.submodel ?? null,
    boltPattern: input.boltPattern ?? null,
    centerBoreMm: input.centerBoreMm ? String(input.centerBoreMm) : null,
    threadSize: input.threadSize ?? null,
    seatType: input.seatType ?? null,
    offsetMinMm: input.offsetMinMm !== undefined && input.offsetMinMm !== null ? String(input.offsetMinMm) : null,
    offsetMaxMm: input.offsetMaxMm !== undefined && input.offsetMaxMm !== null ? String(input.offsetMaxMm) : null,
    oemWheelSizes: input.oemWheelSizes ?? [],
    oemTireSizes: input.oemTireSizes ?? [],
    source: "manual",
    lastVerifiedAt: new Date(),
  };
}
