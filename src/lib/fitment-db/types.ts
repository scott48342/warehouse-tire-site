/**
 * Fitment Database Types
 * 
 * Canonical identity: year + make + model + modification_id
 * Separates raw source data from normalized runtime data
 */

// ============================================================================
// Source Records - Raw API responses stored for debugging/reprocessing
// ============================================================================

export type FitmentSource = "wheelsize" | "wheelpros" | "tireconnect" | "manual" | "import";

export interface FitmentSourceRecord {
  id: string;
  source: FitmentSource;
  source_id: string; // External ID from the source (e.g., Wheel-Size slug)
  year: number;
  make: string;
  model: string;
  raw_payload: Record<string, unknown>; // Full API response, unchanged
  fetched_at: Date;
  checksum: string; // SHA256 of raw_payload for change detection
}

// ============================================================================
// Vehicle Fitments - Normalized fitment data for runtime use
// ============================================================================

export interface VehicleFitment {
  id: string;
  
  // Canonical identity
  year: number;
  make: string;
  model: string;
  modification_id: string; // Unique per year/make/model variant
  
  // Trim/submodel display
  raw_trim: string | null; // Original value from source (e.g., "5.7i", "3.8L V6")
  display_trim: string; // Customer-facing label (e.g., "Z28", "LTZ")
  submodel: string | null; // Additional submodel info (e.g., "Unlimited", "Crew Cab")
  
  // Wheel specifications
  bolt_pattern: string | null; // e.g., "5x120"
  center_bore_mm: number | null; // e.g., 72.6
  thread_size: string | null; // e.g., "M14x1.5"
  seat_type: string | null; // e.g., "conical", "ball", "flat"
  
  // Offset range (mm)
  offset_min_mm: number | null;
  offset_max_mm: number | null;
  
  // OEM wheel sizes (JSON array)
  oem_wheel_sizes: OemWheelSize[];
  
  // OEM tire sizes (JSON array)
  oem_tire_sizes: OemTireSize[];
  
  // Source tracking
  source: FitmentSource;
  source_record_id: string | null; // FK to fitment_source_records
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  last_verified_at: Date | null; // When we last confirmed data is still accurate
}

export interface OemWheelSize {
  diameter: number; // inches
  width: number; // inches
  offset: number; // mm
  is_front: boolean;
  is_rear: boolean;
  is_staggered: boolean;
}

export interface OemTireSize {
  width: number; // mm (e.g., 255)
  aspect_ratio: number; // (e.g., 45)
  diameter: number; // inches (e.g., 18)
  load_index: string | null;
  speed_rating: string | null;
  is_front: boolean;
  is_rear: boolean;
}

// ============================================================================
// Fitment Overrides - Manual corrections to source data
// ============================================================================

export type OverrideScope = "global" | "year" | "make" | "model" | "modification";

export interface FitmentOverride {
  id: string;
  
  // Scope: how specific is this override?
  scope: OverrideScope;
  
  // Match criteria (null = wildcard)
  year: number | null;
  make: string | null;
  model: string | null;
  modification_id: string | null;
  
  // Override values (null = don't override)
  display_trim: string | null;
  bolt_pattern: string | null;
  center_bore_mm: number | null;
  thread_size: string | null;
  seat_type: string | null;
  offset_min_mm: number | null;
  offset_max_mm: number | null;
  
  // Metadata
  reason: string; // Why this override exists
  created_by: string;
  created_at: Date;
  updated_at: Date;
  active: boolean;
}

// ============================================================================
// Import Jobs - Track batch imports from source APIs
// ============================================================================

export type ImportJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface FitmentImportJob {
  id: string;
  source: FitmentSource;
  
  // Job scope
  year_start: number | null;
  year_end: number | null;
  makes: string[] | null; // null = all makes
  
  // Progress
  status: ImportJobStatus;
  total_records: number;
  processed_records: number;
  imported_records: number;
  skipped_records: number;
  error_count: number;
  
  // Timing
  started_at: Date | null;
  completed_at: Date | null;
  
  // Error details
  last_error: string | null;
  error_log: string[] | null;
  
  created_at: Date;
}

// ============================================================================
// Query/Insert Types
// ============================================================================

export type VehicleFitmentInsert = Omit<VehicleFitment, "id" | "created_at" | "updated_at">;
export type VehicleFitmentUpdate = Partial<Omit<VehicleFitment, "id" | "created_at">>;

export type FitmentOverrideInsert = Omit<FitmentOverride, "id" | "created_at" | "updated_at">;

export interface FitmentLookupParams {
  year: number;
  make: string;
  model: string;
  modification_id?: string;
}

export interface FitmentLookupResult {
  fitment: VehicleFitment | null;
  source: "db" | "api" | "cache";
  fromCache: boolean;
  apiCalled: boolean;
}

// ============================================================================
// Canonical Key Generation
// ============================================================================

export interface CanonicalKey {
  year: number;
  make: string; // lowercase, slugified
  model: string; // lowercase, slugified
  modification_id: string; // lowercase
}

export function makeCanonicalKey(year: number, make: string, model: string, modificationId: string): string {
  const y = String(year);
  const ma = make.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  const mo = model.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  const mod = modificationId.toLowerCase().trim();
  return `${y}:${ma}:${mo}:${mod}`;
}

export function parseCanonicalKey(key: string): CanonicalKey | null {
  const parts = key.split(":");
  if (parts.length !== 4) return null;
  const year = parseInt(parts[0], 10);
  if (isNaN(year)) return null;
  return {
    year,
    make: parts[1],
    model: parts[2],
    modification_id: parts[3],
  };
}
