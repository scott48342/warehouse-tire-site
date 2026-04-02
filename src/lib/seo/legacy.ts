/**
 * Legacy SEO Functions
 * 
 * These functions support the existing /tires/for/[vehicleSlug] route.
 * They bridge the old slug-based approach with the new YMM-based approach.
 */

import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { sql, eq, and } from "drizzle-orm";
import { toSlug, getMakeDisplay, getModelDisplay } from "./slugs";

// ============================================================================
// Types
// ============================================================================

export interface LegacyVehicle {
  year: number;
  make: string;
  model: string;
  slug: string;
  displayName: string;
}

// ============================================================================
// Slug Utilities
// ============================================================================

/**
 * Create a vehicle slug from year/make/model
 * "2024-ford-f-150"
 * Accepts either a vehicle object or individual params
 */
export function slugifyVehicle(
  yearOrVehicle: number | { year: number | string; make: string; model: string },
  make?: string,
  model?: string
): string {
  if (typeof yearOrVehicle === "object") {
    const v = yearOrVehicle;
    return `${v.year}-${toSlug(v.make)}-${toSlug(v.model)}`;
  }
  return `${yearOrVehicle}-${toSlug(make!)}-${toSlug(model!)}`;
}

/**
 * Parse a vehicle slug back to components
 */
export function parseVehicleSlug(slug: string): { year: number; make: string; model: string } | null {
  const parts = slug.split("-");
  if (parts.length < 3) return null;
  
  const year = parseInt(parts[0], 10);
  if (isNaN(year) || year < 1990 || year > 2030) return null;
  
  // The rest is make-model, but we need to figure out where make ends and model begins
  // Common patterns: make is usually one word, model can be multiple
  // ford-f-150, toyota-camry, mercedes-benz-gle
  const rest = parts.slice(1);
  
  // Try known two-word makes
  const twoWordMakes = ["mercedes-benz", "alfa-romeo", "land-rover", "aston-martin", "rolls-royce"];
  const firstTwo = rest.slice(0, 2).join("-");
  
  if (twoWordMakes.includes(firstTwo) && rest.length > 2) {
    return {
      year,
      make: firstTwo,
      model: rest.slice(2).join("-"),
    };
  }
  
  // Default: first part is make, rest is model
  return {
    year,
    make: rest[0],
    model: rest.slice(1).join("-"),
  };
}

/**
 * Format vehicle name for display
 * Accepts either a vehicle object or individual year/make/model params
 */
export function formatVehicleName(
  yearOrVehicle: number | { year: number | string; make: string; model: string },
  make?: string,
  model?: string
): string {
  if (typeof yearOrVehicle === "object") {
    const v = yearOrVehicle;
    return `${v.year} ${getMakeDisplay(v.make)} ${getModelDisplay(v.model)}`;
  }
  return `${yearOrVehicle} ${getMakeDisplay(make!)} ${getModelDisplay(model!)}`;
}

// ============================================================================
// Database Queries
// ============================================================================

/**
 * Get vehicle by slug
 * Returns parsed vehicle info even if DB is unavailable
 */
export async function getVehicleBySlug(slug: string): Promise<LegacyVehicle | null> {
  const parsed = parseVehicleSlug(slug);
  if (!parsed) return null;
  
  try {
    // Check if vehicle exists in database
    const [fitment] = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, parsed.year),
          eq(vehicleFitments.make, parsed.make.toLowerCase()),
          eq(vehicleFitments.model, parsed.model.toLowerCase())
        )
      )
      .limit(1);
    
    if (!fitment) {
      // Vehicle might still be valid even without fitment data
      return {
        year: parsed.year,
        make: parsed.make,
        model: parsed.model,
        slug,
        displayName: formatVehicleName(parsed.year, parsed.make, parsed.model),
      };
    }
    
    return {
      year: fitment.year,
      make: fitment.make,
      model: fitment.model,
      slug,
      displayName: formatVehicleName(fitment.year, fitment.make, fitment.model),
    };
  } catch (err) {
    console.error("[seo/legacy] Error getting vehicle by slug:", err);
    // Fallback: return parsed vehicle info without DB validation
    // This allows the page to render with basic info even if DB is unavailable
    return {
      year: parsed.year,
      make: parsed.make,
      model: parsed.model,
      slug,
      displayName: formatVehicleName(parsed.year, parsed.make, parsed.model),
    };
  }
}

/**
 * Get static vehicle params for pre-rendering
 * Returns empty array during Vercel build to avoid DB access failures
 */
export async function getStaticVehicleParams(): Promise<Array<{ vehicleSlug: string }>> {
  // Skip DB access during Vercel build - rely on ISR instead
  const isBuildTime = process.env.VERCEL_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';
  
  if (isBuildTime) {
    console.log("[seo/legacy] Build time detected - returning empty static params");
    return [];
  }
  
  try {
    const results = await db.execute(sql`
      SELECT DISTINCT year, make, model
      FROM vehicle_fitments
      WHERE year >= 2020
      ORDER BY year DESC, make, model
      LIMIT 200
    `);
    
    return (results.rows as any[]).map(row => ({
      vehicleSlug: slugifyVehicle(row.year, row.make, row.model),
    }));
  } catch (err) {
    console.error("[seo/legacy] Error getting static params:", err);
    return [];
  }
}

/**
 * Get related vehicles for internal linking
 */
export async function getRelatedVehicles(
  year: number,
  make: string,
  model: string,
  limit: number = 6
): Promise<LegacyVehicle[]> {
  try {
    // Get other years of same model + other models from same make
    const results = await db.execute(sql`
      (
        SELECT DISTINCT year, make, model
        FROM vehicle_fitments
        WHERE make = ${make.toLowerCase()} AND model = ${model.toLowerCase()} AND year != ${year}
        ORDER BY year DESC
        LIMIT 3
      )
      UNION
      (
        SELECT DISTINCT year, make, model
        FROM vehicle_fitments
        WHERE make = ${make.toLowerCase()} AND model != ${model.toLowerCase()} AND year >= 2020
        ORDER BY year DESC, model
        LIMIT 3
      )
      LIMIT ${limit}
    `);
    
    return (results.rows as any[]).map(row => ({
      year: row.year,
      make: row.make,
      model: row.model,
      slug: slugifyVehicle(row.year, row.make, row.model),
      displayName: formatVehicleName(row.year, row.make, row.model),
    }));
  } catch (err) {
    console.error("[seo/legacy] Error getting related vehicles:", err);
    return [];
  }
}
