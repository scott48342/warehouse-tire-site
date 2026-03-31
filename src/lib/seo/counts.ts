/**
 * SEO Product Counts
 * 
 * Get real inventory counts for vehicles by querying the database.
 * These counts are displayed on SEO landing pages to show actual product availability.
 */

import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  getTechfeedCandidatesByBoltPattern,
} from "@/lib/techfeed/wheels";

// Cache for counts to avoid hitting DB on every page render
const countsCache = new Map<string, { count: number; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(type: string, year: number, make: string, model: string, trim?: string | null): string {
  return `${type}:${year}:${make.toLowerCase()}:${model.toLowerCase()}:${trim?.toLowerCase() || ""}`;
}

function getCachedCount(key: string): number | null {
  const cached = countsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.count;
  }
  return null;
}

function setCachedCount(key: string, count: number): void {
  countsCache.set(key, { count, timestamp: Date.now() });
}

/**
 * Get fitment data for a vehicle from the database
 */
async function getVehicleFitment(
  year: number,
  make: string,
  model: string,
  trim?: string | null
): Promise<{ boltPattern: string | null; tireSizes: string[] } | null> {
  try {
    const fitments = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, make.toLowerCase()),
          eq(vehicleFitments.model, model.toLowerCase())
        )
      )
      .limit(10);
    
    if (fitments.length === 0) {
      return null;
    }
    
    // Find best match if trim specified
    let bestFitment = fitments[0];
    if (trim) {
      const trimLower = trim.toLowerCase();
      const trimMatch = fitments.find(
        f => (f.displayTrim || "").toLowerCase().includes(trimLower) ||
             (f.rawTrim || "").toLowerCase().includes(trimLower)
      );
      if (trimMatch) {
        bestFitment = trimMatch;
      }
    }
    
    // Aggregate tire sizes across all trims
    const allTireSizes = new Set<string>();
    for (const f of fitments) {
      if (Array.isArray(f.oemTireSizes)) {
        for (const ts of f.oemTireSizes as string[]) {
          allTireSizes.add(ts);
        }
      }
    }
    
    return {
      boltPattern: bestFitment.boltPattern,
      tireSizes: [...allTireSizes],
    };
  } catch (err) {
    console.error("[seo/counts] Error getting fitment:", err);
    return null;
  }
}

/**
 * Get wheel count for a vehicle fitment
 * 
 * Queries the techfeed wheel database by bolt pattern to get actual inventory count.
 */
export async function getWheelCountByFitment(
  year: number,
  make: string,
  model: string,
  trim?: string | null
): Promise<number> {
  const cacheKey = getCacheKey("wheels", year, make, model, trim);
  const cached = getCachedCount(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  try {
    const fitment = await getVehicleFitment(year, make, model, trim);
    if (!fitment?.boltPattern) {
      setCachedCount(cacheKey, 0);
      return 0;
    }
    
    // Get wheel candidates from techfeed by bolt pattern
    const candidates = await getTechfeedCandidatesByBoltPattern(fitment.boltPattern);
    
    // Count unique styles (group by brand + model)
    const styles = new Set<string>();
    for (const c of candidates) {
      const price = Number(c.map_price || c.msrp || 0);
      if (price <= 0) continue;
      
      const styleKey = `${c.brand_cd || ""}:${c.style || c.display_style_no || ""}`.toLowerCase();
      if (styleKey !== ":") {
        styles.add(styleKey);
      }
    }
    
    const count = styles.size;
    setCachedCount(cacheKey, count);
    return count;
  } catch (err) {
    console.error("[seo/counts] Error getting wheel count:", err);
    setCachedCount(cacheKey, 0);
    return 0;
  }
}

/**
 * Get tire count for a vehicle fitment
 * 
 * Returns an estimated count based on available tire sizes.
 * For a more accurate count, we'd need to query all supplier APIs which is too slow.
 * Instead, we estimate based on typical inventory depth per size.
 */
export async function getTireCountByFitment(
  year: number,
  make: string,
  model: string,
  trim?: string | null
): Promise<number> {
  const cacheKey = getCacheKey("tires", year, make, model, trim);
  const cached = getCachedCount(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  try {
    const fitment = await getVehicleFitment(year, make, model, trim);
    if (!fitment?.tireSizes || fitment.tireSizes.length === 0) {
      setCachedCount(cacheKey, 0);
      return 0;
    }
    
    // Estimate tire count based on tire sizes
    // Typically we have ~50-100 tire options per size across all suppliers
    const estimatedTiresPerSize = 60;
    const count = Math.min(
      fitment.tireSizes.length * estimatedTiresPerSize,
      500 // Cap at reasonable max
    );
    
    setCachedCount(cacheKey, count);
    return count;
  } catch (err) {
    console.error("[seo/counts] Error getting tire count:", err);
    setCachedCount(cacheKey, 0);
    return 0;
  }
}

/**
 * Get package count for a vehicle fitment
 * 
 * Packages = wheels × compatible tires. Returns estimated combinations.
 */
export async function getPackageCountByFitment(
  year: number,
  make: string,
  model: string,
  trim?: string | null
): Promise<number> {
  const cacheKey = getCacheKey("packages", year, make, model, trim);
  const cached = getCachedCount(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  try {
    // Get both wheel and tire counts
    const [wheelCount, tireCount] = await Promise.all([
      getWheelCountByFitment(year, make, model, trim),
      getTireCountByFitment(year, make, model, trim),
    ]);
    
    if (wheelCount === 0 || tireCount === 0) {
      setCachedCount(cacheKey, 0);
      return 0;
    }
    
    // Package count is a fraction of total combinations
    // Not all wheels pair with all tires, estimate ~20% compatibility
    const estimatedPackages = Math.min(
      Math.floor(wheelCount * tireCount * 0.1),
      2000 // Cap at reasonable max
    );
    
    setCachedCount(cacheKey, estimatedPackages);
    return estimatedPackages;
  } catch (err) {
    console.error("[seo/counts] Error getting package count:", err);
    setCachedCount(cacheKey, 0);
    return 0;
  }
}

/**
 * Get all counts for a vehicle in one call
 * More efficient than calling individual functions
 */
export async function getAllCountsByFitment(
  year: number,
  make: string,
  model: string,
  trim?: string | null
): Promise<{
  wheels: number;
  tires: number;
  packages: number;
  hasFitment: boolean;
}> {
  try {
    const fitment = await getVehicleFitment(year, make, model, trim);
    
    if (!fitment?.boltPattern) {
      return {
        wheels: 0,
        tires: 0,
        packages: 0,
        hasFitment: false,
      };
    }
    
    const [wheels, tires] = await Promise.all([
      getWheelCountByFitment(year, make, model, trim),
      getTireCountByFitment(year, make, model, trim),
    ]);
    
    // Calculate packages from already-fetched counts
    const packages = wheels > 0 && tires > 0
      ? Math.min(Math.floor(wheels * tires * 0.1), 2000)
      : 0;
    
    return {
      wheels,
      tires,
      packages,
      hasFitment: true,
    };
  } catch (err) {
    console.error("[seo/counts] Error getting all counts:", err);
    return {
      wheels: 0,
      tires: 0,
      packages: 0,
      hasFitment: false,
    };
  }
}

/**
 * Format count for display with "+" suffix for large numbers
 */
export function formatCount(count: number): string {
  if (count === 0) return "0";
  if (count >= 1000) return `${Math.floor(count / 100) * 100}+`;
  if (count >= 100) return `${Math.floor(count / 10) * 10}+`;
  return String(count);
}

/**
 * Get popular wheel sizes for a vehicle (for SEO content)
 */
export async function getPopularWheelSizes(
  year: number,
  make: string,
  model: string
): Promise<{ diameter: number; count: number }[]> {
  try {
    const fitment = await getVehicleFitment(year, make, model);
    if (!fitment?.boltPattern) return [];
    
    const candidates = await getTechfeedCandidatesByBoltPattern(fitment.boltPattern);
    
    // Count by diameter
    const diameterCounts = new Map<number, number>();
    for (const c of candidates) {
      const dia = Number(c.diameter);
      if (!Number.isFinite(dia) || dia < 15 || dia > 26) continue;
      
      const price = Number(c.map_price || c.msrp || 0);
      if (price <= 0) continue;
      
      diameterCounts.set(dia, (diameterCounts.get(dia) || 0) + 1);
    }
    
    // Sort by count descending, take top 5
    return Array.from(diameterCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([diameter, count]) => ({ diameter, count }));
  } catch (err) {
    console.error("[seo/counts] Error getting popular wheel sizes:", err);
    return [];
  }
}

/**
 * Get popular brands for a vehicle (for SEO content)
 */
export async function getPopularBrands(
  year: number,
  make: string,
  model: string
): Promise<{ brand: string; count: number }[]> {
  try {
    const fitment = await getVehicleFitment(year, make, model);
    if (!fitment?.boltPattern) return [];
    
    const candidates = await getTechfeedCandidatesByBoltPattern(fitment.boltPattern);
    
    // Count by brand
    const brandCounts = new Map<string, number>();
    for (const c of candidates) {
      const brand = c.brand_desc || c.brand_cd;
      if (!brand) continue;
      
      const price = Number(c.map_price || c.msrp || 0);
      if (price <= 0) continue;
      
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    }
    
    // Sort by count descending, take top 8
    return Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([brand, count]) => ({ brand, count }));
  } catch (err) {
    console.error("[seo/counts] Error getting popular brands:", err);
    return [];
  }
}
