/**
 * Public Fitment Service
 * 
 * Clean interface for public API consumers.
 * Wraps internal fitment-db functions with public-safe response shapes.
 * 
 * This is the ONLY interface the public API routes should use.
 * Internal storefront code continues to use fitment-db directly.
 */

import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { normalizeMake, normalizeModel } from "@/lib/fitment-db/keys";
import { makeSlugMatch } from "@/lib/fitment-db/makeMatch";
import { getModelVariants } from "@/lib/fitment-db/modelAliases";
import { getFitmentProfile, type FitmentProfile, type FitmentServiceSpecs } from "@/lib/fitment-db/profileService";

// ============================================================================
// Public Response Types (clean, no internal fields)
// ============================================================================

export interface PublicYear {
  year: number;
}

export interface PublicMake {
  make: string;
  displayName: string;
}

export interface PublicModel {
  model: string;
  displayName: string;
}

export interface PublicTrim {
  trimId: string;
  name: string;
}

export interface PublicWheelSpec {
  diameter: number;
  width: number;
  offset: number | null;
  tireSize: string | null;
  position: "front" | "rear" | "all";
}

export interface PublicFitmentSpecs {
  year: number;
  make: string;
  model: string;
  trim: string;
  boltPattern: string | null;
  centerBore: number | null;
  threadSize: string | null;
  /** OE service specs when on file: lug torque (ft-lb), placard tire pressure (psi), load index */
  serviceSpecs: FitmentServiceSpecs | null;
  isStaggered: boolean;
  wheelSpecs: PublicWheelSpec[];
  tireSizes: string[];
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all available years (across all makes/models)
 */
/** Rows pulled from service must never reach the public API. Apply to every query. */
const notQuarantined = () => isNull(vehicleFitments.quarantinedAt);

export async function getPublicYears(): Promise<PublicYear[]> {
  const result = await db
    .selectDistinct({ year: vehicleFitments.year })
    .from(vehicleFitments)
    .where(notQuarantined())
    .orderBy(sql`${vehicleFitments.year} DESC`);
  
  return result.map(r => ({ year: r.year }));
}

/**
 * Get all makes, optionally filtered by year
 */
export async function getPublicMakes(year?: number): Promise<PublicMake[]> {
  const whereConditions = [notQuarantined(), ...(year ? [eq(vehicleFitments.year, year)] : [])];
  
  const result = await db
    .selectDistinct({ make: vehicleFitments.make })
    .from(vehicleFitments)
    .where(and(...whereConditions))
    .orderBy(vehicleFitments.make);
  
  return result.map(r => ({
    make: r.make,
    displayName: formatDisplayName(r.make),
  }));
}

/**
 * Get models for a make, optionally filtered by year
 */
export async function getPublicModels(make: string, year?: number): Promise<PublicModel[]> {
  const normalizedMake = normalizeMake(make);
  const whereConditions = [notQuarantined(), makeSlugMatch(vehicleFitments.make, normalizedMake)];
  
  if (year) {
    whereConditions.push(eq(vehicleFitments.year, year));
  }
  
  const result = await db
    .selectDistinct({ model: vehicleFitments.model })
    .from(vehicleFitments)
    .where(and(...whereConditions))
    .orderBy(vehicleFitments.model);
  
  return result.map(r => ({
    model: r.model,
    displayName: formatDisplayName(r.model),
  }));
}

/**
 * Get years for a specific make/model
 */
export async function getPublicYearsForModel(make: string, model: string): Promise<PublicYear[]> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  const result = await db
    .selectDistinct({ year: vehicleFitments.year })
    .from(vehicleFitments)
    .where(
      and(
        notQuarantined(),
        makeSlugMatch(vehicleFitments.make, normalizedMake),
        inArray(vehicleFitments.model, modelVariants)
      )
    )
    .orderBy(sql`${vehicleFitments.year} DESC`);
  
  return result.map(r => ({ year: r.year }));
}

/**
 * Get trims for year/make/model
 */
export async function getPublicTrims(
  year: number,
  make: string,
  model: string
): Promise<PublicTrim[]> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  const result = await db
    .selectDistinct({
      modificationId: vehicleFitments.modificationId,
      displayTrim: vehicleFitments.displayTrim,
    })
    .from(vehicleFitments)
    .where(
      and(
        notQuarantined(),
        eq(vehicleFitments.year, year),
        makeSlugMatch(vehicleFitments.make, normalizedMake),
        inArray(vehicleFitments.model, modelVariants)
      )
    )
    .orderBy(vehicleFitments.displayTrim);
  
  return result.map(r => ({
    trimId: r.modificationId,
    name: r.displayTrim,
  }));
}

/**
 * Get full fitment specs for a vehicle
 */
export async function getPublicSpecs(
  year: number,
  make: string,
  model: string,
  trimId: string
): Promise<PublicFitmentSpecs | null> {
  // Use the internal profile service
  const result = await getFitmentProfile(year, make, model, trimId);
  
  if (!result.profile || result.source === "not_found") {
    return null;
  }

  const profile = result.profile;

  // Determine if staggered
  const wheelSpecs = profile.oemWheelSizes || [];
  const frontWheels = wheelSpecs.filter((w: any) => w.axle === "front");
  const rearWheels = wheelSpecs.filter((w: any) => w.axle === "rear");
  const isStaggered = frontWheels.length > 0 && rearWheels.length > 0 &&
    (frontWheels[0]?.width !== rearWheels[0]?.width || 
     frontWheels[0]?.diameter !== rearWheels[0]?.diameter);

  return {
    year: profile.year,
    make: profile.make,
    model: profile.model,
    trim: profile.displayTrim,
    boltPattern: profile.boltPattern,
    centerBore: profile.centerBoreMm,
    threadSize: profile.threadSize,
    serviceSpecs: profile.serviceSpecs ?? null,
    isStaggered,
    wheelSpecs: wheelSpecs.map((w: any) => ({
      diameter: w.diameter,
      width: w.width,
      offset: w.offset,
      tireSize: w.tireSize,
      position: w.axle === "both" ? "all" : w.axle,
    })),
    tireSizes: profile.oemTireSizes || [],
  };
}

// ============================================================================
// Helpers
// ============================================================================

function formatDisplayName(slug: string): string {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
