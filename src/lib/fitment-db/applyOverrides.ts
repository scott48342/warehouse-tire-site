/**
 * Fitment Override Application
 * 
 * Applies manual overrides to fitment records.
 * Overrides are matched by scope (most specific wins):
 * 1. modification - exact match on year/make/model/modification
 * 2. model - matches all modifications for a year/make/model
 * 3. make - matches all models for a year/make
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
  const overrides = await db.query.fitmentOverrides.findMany({
    where: and(
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
    ),
    orderBy: [desc(fitmentOverrides.createdAt)],
  });
  
  // Sort by scope priority (most specific first)
  return overrides.sort((a, b) => {
    const priorityA = SCOPE_PRIORITY[a.scope] || 0;
    const priorityB = SCOPE_PRIORITY[b.scope] || 0;
    return priorityB - priorityA;
  });
}

/**
 * Apply overrides to a fitment record
 * Returns a new record with overrides applied (original unchanged)
 */
export async function applyOverrides(fitment: VehicleFitment): Promise<VehicleFitment> {
  const overrides = await findApplicableOverrides(fitment);
  
  if (overrides.length === 0) {
    return fitment;
  }
  
  // Start with a copy
  const result: VehicleFitment = { ...fitment };
  
  // Apply overrides in order (most specific first, so they win)
  // But we iterate in reverse so less specific are applied first,
  // then more specific overwrite them
  for (const override of [...overrides].reverse()) {
    if (override.displayTrim !== null) {
      result.displayTrim = override.displayTrim;
    }
    if (override.boltPattern !== null) {
      result.boltPattern = override.boltPattern;
    }
    if (override.centerBoreMm !== null) {
      result.centerBoreMm = override.centerBoreMm;
    }
    if (override.threadSize !== null) {
      result.threadSize = override.threadSize;
    }
    if (override.seatType !== null) {
      result.seatType = override.seatType;
    }
    if (override.offsetMinMm !== null) {
      result.offsetMinMm = override.offsetMinMm;
    }
    if (override.offsetMaxMm !== null) {
      result.offsetMaxMm = override.offsetMaxMm;
    }
  }
  
  return result;
}

// ============================================================================
// Override Management
// ============================================================================

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
  offsetMinMm?: number;
  offsetMaxMm?: number;
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
      offsetMinMm: input.offsetMinMm ?? null,
      offsetMaxMm: input.offsetMaxMm ?? null,
      reason: input.reason,
      createdBy: input.createdBy,
      active: true,
    })
    .returning({ id: fitmentOverrides.id });
  
  return inserted.id;
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
  return db.query.fitmentOverrides.findMany({
    where: eq(fitmentOverrides.active, true),
    orderBy: [desc(fitmentOverrides.createdAt)],
  });
}
