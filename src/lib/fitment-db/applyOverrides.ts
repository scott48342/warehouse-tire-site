/**
 * Fitment Override Application
 * 
 * Applies manual overrides to fitment records.
 * Overrides are matched by scope (most specific wins):
 * 1. modification - exact match on year/make/model/modification
 * 2. model - matches all modifications for a year/make/model
 * 3. make - matches all makes for a year/make
 * 4. year - matches all makes for a year
 * 5. global - matches everything
 */

import { db } from "./db";
import { fitmentOverrides } from "./schema";
import type { VehicleFitment, FitmentOverride } from "./schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "./keys";

// Override scope priority (higher = more specific = wins)
const SCOPE_PRIORITY: Record<string, number> = {
  modification: 5,
  model: 4,
  make: 3,
  year: 2,
  global: 1,
};

/**
 * Find all applicable overrides for a fitment record
 * Sorted by specificity (most specific first)
 */
export async function findApplicableOverrides(
  fitment: VehicleFitment
): Promise<FitmentOverride[]> {
  const normalizedMake = normalizeMake(fitment.make);
  const normalizedModel = normalizeModel(fitment.model);
  
  // Query for all potentially matching overrides
  // Wrapped in try-catch to handle schema mismatches gracefully
  let overrides: FitmentOverride[];
  try {
    overrides = await db
      .select()
      .from(fitmentOverrides)
    .where(
      and(
        eq(fitmentOverrides.active, true),
        or(
          // Global overrides
          eq(fitmentOverrides.scope, "global"),
          // Year overrides
          and(
            eq(fitmentOverrides.scope, "year"),
            eq(fitmentOverrides.year, fitment.year)
          ),
          // Make overrides
          and(
            eq(fitmentOverrides.scope, "make"),
            or(
              isNull(fitmentOverrides.year),
              eq(fitmentOverrides.year, fitment.year)
            ),
            eq(fitmentOverrides.make, normalizedMake)
          ),
          // Model overrides
          and(
            eq(fitmentOverrides.scope, "model"),
            or(
              isNull(fitmentOverrides.year),
              eq(fitmentOverrides.year, fitment.year)
            ),
            eq(fitmentOverrides.make, normalizedMake),
            eq(fitmentOverrides.model, normalizedModel)
          ),
          // Modification overrides (most specific)
          and(
            eq(fitmentOverrides.scope, "modification"),
            eq(fitmentOverrides.year, fitment.year),
            eq(fitmentOverrides.make, normalizedMake),
            eq(fitmentOverrides.model, normalizedModel),
            eq(fitmentOverrides.modificationId, fitment.modificationId)
          )
        )
      )
    )
    .orderBy(desc(fitmentOverrides.createdAt));
  } catch (err: any) {
    // Handle schema mismatches gracefully - return empty array
    console.warn(`[applyOverrides] Query failed, returning no overrides: ${err?.message?.slice(0, 100) || String(err)}`);
    return [];
  }
  
  // Sort by scope priority (most specific first)
  return overrides.sort((a, b) => {
    const priorityA = SCOPE_PRIORITY[a.scope] || 0;
    const priorityB = SCOPE_PRIORITY[b.scope] || 0;
    return priorityB - priorityA;
  });
}

/**
 * Result of applying overrides, includes metadata about what changed
 */
export interface ApplyOverridesResult {
  fitment: VehicleFitment;
  overridesApplied: FitmentOverride[];
  forceQuality: "valid" | "partial" | null;
  changed: boolean;
}

/**
 * Apply overrides to a fitment record
 * Returns a new record with overrides applied (original unchanged)
 * 
 * Note: Returns original fitment unchanged if override query fails
 * (e.g., missing columns from pending migrations)
 */
export async function applyOverrides(fitment: VehicleFitment): Promise<VehicleFitment> {
  try {
    const result = await applyOverridesWithMeta(fitment);
    return result.fitment;
  } catch (err: any) {
    // Log but don't fail - overrides are optional
    console.warn(`[applyOverrides] Query failed, returning original:`, err?.message?.slice(0, 100));
    return fitment;
  }
}

/**
 * Apply overrides with full metadata about what was applied
 */
export async function applyOverridesWithMeta(fitment: VehicleFitment): Promise<ApplyOverridesResult> {
  const overrides = await findApplicableOverrides(fitment);
  
  if (overrides.length === 0) {
    return {
      fitment,
      overridesApplied: [],
      forceQuality: null,
      changed: false,
    };
  }
  
  // Start with a copy (deep copy for arrays)
  const result: VehicleFitment = {
    ...fitment,
    oemWheelSizes: fitment.oemWheelSizes ? [...(fitment.oemWheelSizes as any[])] : [],
    oemTireSizes: fitment.oemTireSizes ? [...(fitment.oemTireSizes as any[])] : [],
  };
  
  let forceQuality: "valid" | "partial" | null = null;
  const appliedOverrides: FitmentOverride[] = [];
  
  // Apply overrides in order (most specific first, so they win)
  // But we iterate in reverse so less specific are applied first,
  // then more specific overwrite them
  for (const override of [...overrides].reverse()) {
    let applied = false;
    
    if (override.displayTrim !== null) {
      result.displayTrim = override.displayTrim;
      applied = true;
    }
    if (override.boltPattern !== null) {
      result.boltPattern = override.boltPattern;
      applied = true;
    }
    if (override.centerBoreMm !== null) {
      result.centerBoreMm = override.centerBoreMm;
      applied = true;
    }
    if (override.threadSize !== null) {
      result.threadSize = override.threadSize;
      applied = true;
    }
    if (override.seatType !== null) {
      result.seatType = override.seatType;
      applied = true;
    }
    if (override.offsetMinMm !== null) {
      result.offsetMinMm = override.offsetMinMm;
      applied = true;
    }
    if (override.offsetMaxMm !== null) {
      result.offsetMaxMm = override.offsetMaxMm;
      applied = true;
    }
    
    // Apply OEM sizes (replace entire array if provided)
    if (override.oemWheelSizes !== null && Array.isArray(override.oemWheelSizes)) {
      result.oemWheelSizes = override.oemWheelSizes as any;
      applied = true;
    }
    if (override.oemTireSizes !== null && Array.isArray(override.oemTireSizes)) {
      result.oemTireSizes = override.oemTireSizes as any;
      applied = true;
    }
    
    // Force quality level (most specific wins)
    if (override.forceQuality === "valid" || override.forceQuality === "partial") {
      forceQuality = override.forceQuality;
      applied = true;
    }
    
    if (applied) {
      appliedOverrides.push(override);
    }
  }
  
  return {
    fitment: result,
    overridesApplied: appliedOverrides,
    forceQuality,
    changed: appliedOverrides.length > 0,
  };
}

// ============================================================================
// Override Management
// ============================================================================

export interface OEMWheelSizeOverride {
  diameter: number;
  width: number;
  offset: number | null;
  tireSize?: string | null;
  axle: "front" | "rear" | "both";
  isStock: boolean;
}

export interface CreateOverrideInput {
  scope: "global" | "year" | "make" | "model" | "modification";
  year?: number;
  make?: string;
  model?: string;
  modificationId?: string;
  displayTrim?: string;
  boltPattern?: string;
  centerBoreMm?: number;
  threadSize?: string;
  seatType?: string;
  offsetMinMm?: number | null;  // null = clear override
  offsetMaxMm?: number | null;  // null = clear override
  oemWheelSizes?: OEMWheelSizeOverride[];
  oemTireSizes?: string[];
  forceQuality?: "valid" | "partial";
  notes?: string;
  reason: string;
  createdBy: string;
}

/**
 * Create a new override
 */
export async function createOverride(input: CreateOverrideInput): Promise<string> {
  const [inserted] = await db
    .insert(fitmentOverrides)
    .values({
      scope: input.scope,
      year: input.year ?? null,
      make: input.make ? normalizeMake(input.make) : null,
      model: input.model ? normalizeModel(input.model) : null,
      modificationId: input.modificationId ? slugify(input.modificationId) : null,
      displayTrim: input.displayTrim ?? null,
      boltPattern: input.boltPattern ?? null,
      centerBoreMm: input.centerBoreMm ? String(input.centerBoreMm) : null,
      threadSize: input.threadSize ?? null,
      seatType: input.seatType ?? null,
      offsetMinMm: input.offsetMinMm !== undefined && input.offsetMinMm !== null ? String(input.offsetMinMm) : null,
      offsetMaxMm: input.offsetMaxMm !== undefined && input.offsetMaxMm !== null ? String(input.offsetMaxMm) : null,
      oemWheelSizes: input.oemWheelSizes ? (input.oemWheelSizes as any) : null,
      oemTireSizes: input.oemTireSizes ? (input.oemTireSizes as any) : null,
      forceQuality: input.forceQuality ?? null,
      notes: input.notes ?? null,
      reason: input.reason,
      createdBy: input.createdBy,
      active: true,
    })
    .returning({ id: fitmentOverrides.id });
  
  return inserted.id;
}

/**
 * Update an existing override
 */
export async function updateOverride(
  overrideId: string,
  input: Partial<Omit<CreateOverrideInput, "scope" | "createdBy">>
): Promise<void> {
  const updates: Record<string, any> = { updatedAt: new Date() };
  
  if (input.year !== undefined) updates.year = input.year;
  if (input.make !== undefined) updates.make = input.make ? normalizeMake(input.make) : null;
  if (input.model !== undefined) updates.model = input.model ? normalizeModel(input.model) : null;
  if (input.modificationId !== undefined) updates.modificationId = input.modificationId ? slugify(input.modificationId) : null;
  if (input.displayTrim !== undefined) updates.displayTrim = input.displayTrim;
  if (input.boltPattern !== undefined) updates.boltPattern = input.boltPattern;
  if (input.centerBoreMm !== undefined) updates.centerBoreMm = input.centerBoreMm ? String(input.centerBoreMm) : null;
  if (input.threadSize !== undefined) updates.threadSize = input.threadSize;
  if (input.seatType !== undefined) updates.seatType = input.seatType;
  if (input.offsetMinMm !== undefined) updates.offsetMinMm = input.offsetMinMm !== null ? String(input.offsetMinMm) : null;
  if (input.offsetMaxMm !== undefined) updates.offsetMaxMm = input.offsetMaxMm !== null ? String(input.offsetMaxMm) : null;
  if (input.oemWheelSizes !== undefined) updates.oemWheelSizes = input.oemWheelSizes;
  if (input.oemTireSizes !== undefined) updates.oemTireSizes = input.oemTireSizes;
  if (input.forceQuality !== undefined) updates.forceQuality = input.forceQuality;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.reason !== undefined) updates.reason = input.reason;
  
  await db
    .update(fitmentOverrides)
    .set(updates)
    .where(eq(fitmentOverrides.id, overrideId));
}

/**
 * Get a single override by ID
 */
export async function getOverride(overrideId: string): Promise<FitmentOverride | null> {
  const [override] = await db
    .select()
    .from(fitmentOverrides)
    .where(eq(fitmentOverrides.id, overrideId))
    .limit(1);
  return override ?? null;
}

/**
 * Find override by vehicle match criteria
 */
export async function findOverrideByVehicle(
  year: number,
  make: string,
  model: string,
  modificationId?: string
): Promise<FitmentOverride | null> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  const normalizedModId = modificationId ? slugify(modificationId) : null;
  
  // Find most specific matching override
  const overrides = await db
    .select()
    .from(fitmentOverrides)
    .where(
      and(
        eq(fitmentOverrides.active, true),
        or(
          // Exact modification match
          and(
            eq(fitmentOverrides.scope, "modification"),
            eq(fitmentOverrides.year, year),
            eq(fitmentOverrides.make, normalizedMake),
            eq(fitmentOverrides.model, normalizedModel),
            normalizedModId ? eq(fitmentOverrides.modificationId, normalizedModId) : isNull(fitmentOverrides.modificationId)
          ),
          // Model match
          and(
            eq(fitmentOverrides.scope, "model"),
            or(isNull(fitmentOverrides.year), eq(fitmentOverrides.year, year)),
            eq(fitmentOverrides.make, normalizedMake),
            eq(fitmentOverrides.model, normalizedModel)
          )
        )
      )
    )
    .orderBy(desc(fitmentOverrides.createdAt))
    .limit(1);
  
  return overrides[0] ?? null;
}

/**
 * Deactivate an override (soft delete)
 */
export async function deactivateOverride(overrideId: string): Promise<void> {
  await db
    .update(fitmentOverrides)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(fitmentOverrides.id, overrideId));
}

/**
 * List all active overrides
 */
export async function listOverrides(): Promise<FitmentOverride[]> {
  return db
    .select()
    .from(fitmentOverrides)
    .where(eq(fitmentOverrides.active, true))
    .orderBy(desc(fitmentOverrides.createdAt));
}
