/**
 * OEM Package Choices Service
 * 
 * Provides customer-friendly package labels for multi-config trims.
 * When a trim has multiple OEM wheel/tire configurations, this replaces
 * the generic size chooser with descriptive package labels.
 */

import { getDbPool } from "@/lib/db/pool";

// =============================================================================
// Types
// =============================================================================

export interface OemPackageChoice {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  packageLabel: string;
  packageDescription: string | null;
  wheelDiameter: number;
  rimWidth: number | null;
  tireSize: string;
  tireSizeRear: string | null;
  loadRating: string | null;
  source: string;
  confidence: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  displayOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

export interface PackageChoiceOption {
  wheelDiameter: number;
  tireSize: string;
  tireSizeRear: string | null;
  packageLabel: string;
  packageDescription: string | null;
  isStaggered: boolean;
}

export interface PackageChoicesResult {
  available: boolean;
  choices: PackageChoiceOption[];
  title: string;
  helperText: string;
}

// =============================================================================
// Constants
// =============================================================================

const CHOOSER_TITLE = "Select your factory wheel package";
const CHOOSER_HELPER = "Some trims came with more than one factory wheel setup. Choose the one that matches your vehicle.";

// =============================================================================
// Trim Normalization
// =============================================================================

/**
 * Extract display trim from a canonical fitment ID or slug.
 * 
 * Examples:
 * - "2020-ram-1500-big-horn-148347" → "Big Horn"
 * - "ram-1500-big-horn-8b33058e" → "Big Horn"
 * - "Big Horn" → "Big Horn"
 * - "big-horn" → "Big Horn"
 */
function normalizeDisplayTrim(trim: string): string {
  if (!trim) return "";
  
  // If it's already a clean display trim (no hyphens, not a slug), return as-is
  if (!trim.includes("-") || /^[A-Z][a-z]/.test(trim)) {
    return trim;
  }
  
  // Try to extract trim from canonical fitment ID format: year-make-model-trim-hash
  // e.g., "2020-ram-1500-big-horn-148347" → "big-horn"
  const canonicalMatch = trim.match(/^\d{4}-[a-z]+-[a-z0-9]+-(.+)-[a-f0-9]{6,}$/i);
  if (canonicalMatch) {
    return slugToTitle(canonicalMatch[1]);
  }
  
  // Try to extract trim from modification slug format: make-model-trim-hash
  // e.g., "ram-1500-big-horn-8b33058e" → "big-horn"
  const modMatch = trim.match(/^[a-z]+-[a-z0-9]+-(.+)-[a-f0-9]{6,}$/i);
  if (modMatch) {
    return slugToTitle(modMatch[1]);
  }
  
  // If it looks like a simple slug (all lowercase, has hyphens), convert to title case
  if (/^[a-z0-9-]+$/.test(trim)) {
    return slugToTitle(trim);
  }
  
  return trim;
}

/**
 * Convert a slug to title case.
 * e.g., "big-horn" → "Big Horn", "at4" → "AT4"
 */
function slugToTitle(slug: string): string {
  // Special cases for known trims that should stay uppercase
  const uppercaseTrims: Record<string, string> = {
    "at4": "AT4",
    "srt": "SRT",
    "rt": "R/T",
    "zr2": "ZR2",
    "trd": "TRD",
    "sr5": "SR5",
    "xlt": "XLT",
    "sel": "SEL",
    "wt": "WT",
    "lt": "LT",
    "ltz": "LTZ",
    "sle": "SLE",
    "slt": "SLT",
    "z71": "Z71",
  };
  
  const lower = slug.toLowerCase();
  if (uppercaseTrims[lower]) {
    return uppercaseTrims[lower];
  }
  
  // Convert hyphenated slug to title case
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// =============================================================================
// Database Queries
// =============================================================================

/**
 * Get approved package choices for a specific YMM/trim.
 * Only returns approved choices - pending/rejected are excluded from runtime.
 * 
 * Normalizes trim input to handle:
 * - Display trims: "Big Horn"
 * - Slugs: "big-horn"
 * - Canonical IDs: "2020-ram-1500-big-horn-148347"
 */
export async function getApprovedPackageChoices(
  year: number,
  make: string,
  model: string,
  trim: string
): Promise<OemPackageChoice[]> {
  // Normalize the trim to extract display name from slugs/canonical IDs
  const normalizedTrim = normalizeDisplayTrim(trim);
  console.log(`[oemPackageChoices] Normalized trim: "${trim}" → "${normalizedTrim}"`);
  
  const pool = getDbPool();
  if (!pool) return [];

  try {
    const result = await pool.query<{
      id: string;
      year: number;
      make: string;
      model: string;
      trim: string;
      package_label: string;
      package_description: string | null;
      wheel_diameter: number;
      rim_width: number | null;
      tire_size: string;
      tire_size_rear: string | null;
      load_rating: string | null;
      source: string;
      confidence: string;
      status: string;
      display_order: number;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
      reviewed_at: Date | null;
      reviewed_by: string | null;
    }>(`
      SELECT * FROM oem_package_choices
      WHERE year = $1 
        AND LOWER(make) = LOWER($2)
        AND LOWER(model) = LOWER($3)
        AND LOWER(trim) = LOWER($4)
        AND status = 'approved'
      ORDER BY display_order ASC, wheel_diameter ASC
    `, [year, make, model, normalizedTrim]);

    return result.rows.map(row => ({
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      packageLabel: row.package_label,
      packageDescription: row.package_description,
      wheelDiameter: row.wheel_diameter,
      rimWidth: row.rim_width,
      tireSize: row.tire_size,
      tireSizeRear: row.tire_size_rear,
      loadRating: row.load_rating,
      source: row.source,
      confidence: row.confidence as "low" | "medium" | "high",
      status: row.status as "pending" | "approved" | "rejected",
      displayOrder: row.display_order,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
    }));
  } catch (error) {
    console.error("[oemPackageChoices] Failed to fetch choices:", error);
    return [];
  }
}

/**
 * Build the package choices result for the frontend.
 * Returns structured data for the size/package chooser UI.
 */
export async function getPackageChoicesForVehicle(
  year: number,
  make: string,
  model: string,
  trim: string
): Promise<PackageChoicesResult> {
  const choices = await getApprovedPackageChoices(year, make, model, trim);

  if (choices.length === 0) {
    return {
      available: false,
      choices: [],
      title: "",
      helperText: "",
    };
  }

  return {
    available: true,
    choices: choices.map(c => ({
      wheelDiameter: c.wheelDiameter,
      tireSize: c.tireSize,
      tireSizeRear: c.tireSizeRear,
      packageLabel: c.packageLabel,
      packageDescription: c.packageDescription,
      isStaggered: !!c.tireSizeRear && c.tireSizeRear !== c.tireSize,
    })),
    title: CHOOSER_TITLE,
    helperText: CHOOSER_HELPER,
  };
}

// =============================================================================
// Admin Functions
// =============================================================================

/**
 * Get all package choices with optional filters (for admin UI).
 */
export async function getAllPackageChoices(options?: {
  status?: "pending" | "approved" | "rejected";
  year?: number;
  make?: string;
  model?: string;
  limit?: number;
}): Promise<OemPackageChoice[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (options?.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(options.status);
  }
  if (options?.year) {
    conditions.push(`year = $${paramIndex++}`);
    params.push(options.year);
  }
  if (options?.make) {
    conditions.push(`LOWER(make) = LOWER($${paramIndex++})`);
    params.push(options.make);
  }
  if (options?.model) {
    conditions.push(`LOWER(model) = LOWER($${paramIndex++})`);
    params.push(options.model);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limitClause = options?.limit ? `LIMIT ${options.limit}` : "LIMIT 100";

  try {
    const result = await pool.query(`
      SELECT * FROM oem_package_choices
      ${whereClause}
      ORDER BY year DESC, make, model, trim, display_order
      ${limitClause}
    `, params);

    return result.rows.map(row => ({
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      packageLabel: row.package_label,
      packageDescription: row.package_description,
      wheelDiameter: row.wheel_diameter,
      rimWidth: row.rim_width,
      tireSize: row.tire_size,
      tireSizeRear: row.tire_size_rear,
      loadRating: row.load_rating,
      source: row.source,
      confidence: row.confidence as "low" | "medium" | "high",
      status: row.status as "pending" | "approved" | "rejected",
      displayOrder: row.display_order,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
    }));
  } catch (error) {
    console.error("[oemPackageChoices] Failed to fetch all choices:", error);
    return [];
  }
}

/**
 * Update the status of a package choice (approve/reject).
 */
export async function updatePackageChoiceStatus(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  notes?: string
): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return false;

  try {
    const result = await pool.query(`
      UPDATE oem_package_choices
      SET status = $1,
          reviewed_at = NOW(),
          reviewed_by = $2,
          notes = COALESCE($3, notes)
      WHERE id = $4
    `, [status, reviewedBy, notes, id]);

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("[oemPackageChoices] Failed to update status:", error);
    return false;
  }
}

/**
 * Create a new package choice (for admin import/manual entry).
 */
export async function createPackageChoice(choice: {
  year: number;
  make: string;
  model: string;
  trim: string;
  packageLabel: string;
  packageDescription?: string;
  wheelDiameter: number;
  rimWidth?: number;
  tireSize: string;
  tireSizeRear?: string;
  loadRating?: string;
  source?: string;
  confidence?: "low" | "medium" | "high";
  displayOrder?: number;
  notes?: string;
}): Promise<OemPackageChoice | null> {
  const pool = getDbPool();
  if (!pool) return null;

  try {
    const result = await pool.query(`
      INSERT INTO oem_package_choices (
        year, make, model, trim, package_label, package_description,
        wheel_diameter, rim_width, tire_size, tire_size_rear, load_rating,
        source, confidence, display_order, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (year, make, model, trim, wheel_diameter) 
      DO UPDATE SET
        package_label = EXCLUDED.package_label,
        package_description = EXCLUDED.package_description,
        tire_size = EXCLUDED.tire_size,
        tire_size_rear = EXCLUDED.tire_size_rear,
        rim_width = EXCLUDED.rim_width,
        load_rating = EXCLUDED.load_rating,
        source = EXCLUDED.source,
        confidence = EXCLUDED.confidence,
        display_order = EXCLUDED.display_order,
        notes = EXCLUDED.notes,
        status = 'pending',
        reviewed_at = NULL,
        reviewed_by = NULL
      RETURNING *
    `, [
      choice.year,
      choice.make,
      choice.model,
      choice.trim,
      choice.packageLabel,
      choice.packageDescription || null,
      choice.wheelDiameter,
      choice.rimWidth || null,
      choice.tireSize,
      choice.tireSizeRear || null,
      choice.loadRating || null,
      choice.source || "manual",
      choice.confidence || "medium",
      choice.displayOrder || 0,
      choice.notes || null,
    ]);

    const row = result.rows[0];
    return row ? {
      id: row.id,
      year: row.year,
      make: row.make,
      model: row.model,
      trim: row.trim,
      packageLabel: row.package_label,
      packageDescription: row.package_description,
      wheelDiameter: row.wheel_diameter,
      rimWidth: row.rim_width,
      tireSize: row.tire_size,
      tireSizeRear: row.tire_size_rear,
      loadRating: row.load_rating,
      source: row.source,
      confidence: row.confidence,
      status: row.status,
      displayOrder: row.display_order,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
    } : null;
  } catch (error) {
    console.error("[oemPackageChoices] Failed to create choice:", error);
    return null;
  }
}
