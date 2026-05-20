/**
 * Researched Fitment Cache Service
 * 
 * Caches successfully researched fitment data to avoid repeated external lookups.
 * 
 * LOOKUP PRIORITY (updated):
 * 1. WTD verified fitment DB (always wins)
 * 2. Curated fallback profiles (hand-maintained)
 * 3. Researched fitment cache (this service) ← NEW
 * 4. Live trusted research (Brave + Claude)
 * 5. External Wheel-Size API (rate limited)
 * 6. Ask customer to verify
 * 
 * FEATURES:
 * - Cache successful research results by year|make|model|trim
 * - Track usage stats (use_count, last_used_at)
 * - Freshness policy with configurable stale period
 * - Admin promotion workflow (approve → curated, reject, merge → verified)
 * - No regression: verified DB always takes precedence
 * 
 * @created 2026-05-20
 */

import { db } from "../db";
import { researchedFitmentCache } from "../fitment-db/schema";
import { eq, and, sql, desc, lt, gt } from "drizzle-orm";
import type { TrustedResearchResult, ResearchedFitment } from "./trustedFitmentResearch";

// =============================================================================
// TYPES
// =============================================================================

export type CacheStatus = "active" | "stale" | "promoted" | "rejected";

export interface CachedResearchedFitment {
  id: number;
  vehicleKey: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  
  // Fitment data (JSON)
  fitment: ResearchedFitment;
  
  // Metadata
  confidence: "high" | "medium" | "low";
  sourcesUsed: string[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
  
  // Usage tracking
  useCount: number;
  
  // Status
  status: CacheStatus;
  staleAt: Date | null;
  
  // Admin workflow
  promotedAt: Date | null;
  promotedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
}

export interface CacheLookupResult {
  found: boolean;
  cached?: CachedResearchedFitment;
  isStale?: boolean;
  cacheHit: boolean;
}

export interface CacheWriteResult {
  success: boolean;
  id?: number;
  error?: string;
  isUpdate?: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Default stale period: 90 days (researched data doesn't change often)
const DEFAULT_STALE_DAYS = 90;

// Get stale period from env or use default
function getStalePeriodDays(): number {
  const envValue = process.env.RESEARCHED_CACHE_STALE_DAYS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_STALE_DAYS;
}

// =============================================================================
// KEY HELPERS
// =============================================================================

/**
 * Build normalized cache key: year|make|model|trim
 */
export function buildVehicleKey(
  year: number,
  make: string,
  model: string,
  trim?: string | null
): string {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  const normalizedTrim = trim ? trim.toLowerCase().trim() : "";
  
  return `${year}|${normalizedMake}|${normalizedModel}${normalizedTrim ? `|${normalizedTrim}` : ""}`;
}

/**
 * Parse vehicle key back to components
 */
export function parseVehicleKey(key: string): {
  year: number;
  make: string;
  model: string;
  trim?: string;
} | null {
  const parts = key.split("|");
  if (parts.length < 3) return null;
  
  return {
    year: parseInt(parts[0], 10),
    make: parts[1],
    model: parts[2],
    trim: parts[3] || undefined,
  };
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Look up cached researched fitment
 */
export async function getCachedResearchedFitment(
  year: number,
  make: string,
  model: string,
  trim?: string | null
): Promise<CacheLookupResult> {
  const vehicleKey = buildVehicleKey(year, make, model, trim);
  
  try {
    // First try exact match with trim
    let cached = await db
      .select()
      .from(researchedFitmentCache)
      .where(
        and(
          eq(researchedFitmentCache.vehicleKey, vehicleKey),
          eq(researchedFitmentCache.status, "active")
        )
      )
      .limit(1);
    
    // If no exact match and trim was provided, try without trim
    if (cached.length === 0 && trim) {
      const keyWithoutTrim = buildVehicleKey(year, make, model);
      cached = await db
        .select()
        .from(researchedFitmentCache)
        .where(
          and(
            eq(researchedFitmentCache.vehicleKey, keyWithoutTrim),
            eq(researchedFitmentCache.status, "active")
          )
        )
        .limit(1);
    }
    
    if (cached.length === 0) {
      return { found: false, cacheHit: false };
    }
    
    const record = cached[0];
    const now = new Date();
    const isStale = record.staleAt ? new Date(record.staleAt) < now : false;
    
    // Update usage stats (fire and forget)
    updateUsageStats(record.id).catch(err => {
      console.warn("[researched-cache] Failed to update usage stats:", err);
    });
    
    return {
      found: true,
      cached: {
        id: record.id,
        vehicleKey: record.vehicleKey,
        year: record.year,
        make: record.make,
        model: record.model,
        trim: record.trim,
        fitment: record.fitment as ResearchedFitment,
        confidence: record.confidence as "high" | "medium" | "low",
        sourcesUsed: record.sourcesUsed as string[],
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        lastUsedAt: new Date(record.lastUsedAt),
        useCount: record.useCount,
        status: record.status as CacheStatus,
        staleAt: record.staleAt ? new Date(record.staleAt) : null,
        promotedAt: record.promotedAt ? new Date(record.promotedAt) : null,
        promotedBy: record.promotedBy,
        rejectedAt: record.rejectedAt ? new Date(record.rejectedAt) : null,
        rejectedBy: record.rejectedBy,
        rejectionReason: record.rejectionReason,
      },
      isStale,
      cacheHit: true,
    };
  } catch (err) {
    console.error("[researched-cache] Lookup error:", err);
    return { found: false, cacheHit: false };
  }
}

/**
 * Store researched fitment in cache
 */
export async function cacheResearchedFitment(
  year: number,
  make: string,
  model: string,
  trim: string | null | undefined,
  result: TrustedResearchResult
): Promise<CacheWriteResult> {
  if (!result.success || !result.fitment) {
    return { success: false, error: "Cannot cache unsuccessful research" };
  }
  
  const vehicleKey = buildVehicleKey(year, make, model, trim);
  const now = new Date();
  const staleDays = getStalePeriodDays();
  const staleAt = new Date(now.getTime() + staleDays * 24 * 60 * 60 * 1000);
  
  try {
    // Check if we already have this cached
    const existing = await db
      .select({ id: researchedFitmentCache.id })
      .from(researchedFitmentCache)
      .where(eq(researchedFitmentCache.vehicleKey, vehicleKey))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      await db
        .update(researchedFitmentCache)
        .set({
          fitment: result.fitment,
          confidence: result.confidence,
          sourcesUsed: result.sourcesUsed,
          updatedAt: now,
          lastUsedAt: now,
          useCount: sql`${researchedFitmentCache.useCount} + 1`,
          status: "active",
          staleAt,
        })
        .where(eq(researchedFitmentCache.id, existing[0].id));
      
      console.log(`[researched-cache] Updated cache for ${vehicleKey}`);
      return { success: true, id: existing[0].id, isUpdate: true };
    }
    
    // Insert new record
    const inserted = await db
      .insert(researchedFitmentCache)
      .values({
        vehicleKey,
        year,
        make: make.toLowerCase().trim(),
        model: model.toLowerCase().trim(),
        trim: trim?.toLowerCase().trim() || null,
        fitment: result.fitment,
        confidence: result.confidence,
        sourcesUsed: result.sourcesUsed,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
        useCount: 1,
        status: "active",
        staleAt,
      })
      .returning({ id: researchedFitmentCache.id });
    
    console.log(`[researched-cache] Cached new research for ${vehicleKey}, id=${inserted[0].id}`);
    return { success: true, id: inserted[0].id, isUpdate: false };
  } catch (err) {
    console.error("[researched-cache] Write error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Update usage stats (use_count, last_used_at)
 */
async function updateUsageStats(id: number): Promise<void> {
  await db
    .update(researchedFitmentCache)
    .set({
      useCount: sql`${researchedFitmentCache.useCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq(researchedFitmentCache.id, id));
}

// =============================================================================
// ADMIN OPERATIONS
// =============================================================================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalCached: number;
  activeCount: number;
  staleCount: number;
  promotedCount: number;
  rejectedCount: number;
  totalHits: number;
  avgUseCount: number;
  topVehicles: Array<{ vehicleKey: string; useCount: number; confidence: string }>;
}> {
  const now = new Date();
  
  // Get counts by status
  const statusCounts = await db
    .select({
      status: researchedFitmentCache.status,
      count: sql<number>`count(*)::int`,
    })
    .from(researchedFitmentCache)
    .groupBy(researchedFitmentCache.status);
  
  // Get stale count (active but past stale date)
  const staleCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(researchedFitmentCache)
    .where(
      and(
        eq(researchedFitmentCache.status, "active"),
        lt(researchedFitmentCache.staleAt, now)
      )
    );
  
  // Get total hits and average
  const usageStats = await db
    .select({
      totalHits: sql<number>`sum(use_count)::int`,
      avgUseCount: sql<number>`avg(use_count)::numeric(10,2)`,
    })
    .from(researchedFitmentCache);
  
  // Get top vehicles
  const topVehicles = await db
    .select({
      vehicleKey: researchedFitmentCache.vehicleKey,
      useCount: researchedFitmentCache.useCount,
      confidence: researchedFitmentCache.confidence,
    })
    .from(researchedFitmentCache)
    .where(eq(researchedFitmentCache.status, "active"))
    .orderBy(desc(researchedFitmentCache.useCount))
    .limit(10);
  
  const counts: Record<string, number> = {};
  for (const row of statusCounts) {
    counts[row.status] = row.count;
  }
  
  return {
    totalCached: Object.values(counts).reduce((a, b) => a + b, 0),
    activeCount: counts["active"] || 0,
    staleCount: staleCount[0]?.count || 0,
    promotedCount: counts["promoted"] || 0,
    rejectedCount: counts["rejected"] || 0,
    totalHits: usageStats[0]?.totalHits || 0,
    avgUseCount: parseFloat(String(usageStats[0]?.avgUseCount || 0)),
    topVehicles,
  };
}

/**
 * List cached profiles with filters
 */
export async function listCachedProfiles(options: {
  status?: CacheStatus;
  staleOnly?: boolean;
  minUseCount?: number;
  limit?: number;
  offset?: number;
}): Promise<CachedResearchedFitment[]> {
  const { status, staleOnly, minUseCount, limit = 50, offset = 0 } = options;
  const now = new Date();
  
  let query = db.select().from(researchedFitmentCache);
  
  const conditions = [];
  
  if (status) {
    conditions.push(eq(researchedFitmentCache.status, status));
  }
  
  if (staleOnly) {
    conditions.push(lt(researchedFitmentCache.staleAt, now));
  }
  
  if (minUseCount !== undefined) {
    conditions.push(gt(researchedFitmentCache.useCount, minUseCount));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  const results = await query
    .orderBy(desc(researchedFitmentCache.useCount))
    .limit(limit)
    .offset(offset);
  
  return results.map(r => ({
    id: r.id,
    vehicleKey: r.vehicleKey,
    year: r.year,
    make: r.make,
    model: r.model,
    trim: r.trim,
    fitment: r.fitment as ResearchedFitment,
    confidence: r.confidence as "high" | "medium" | "low",
    sourcesUsed: r.sourcesUsed as string[],
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    lastUsedAt: new Date(r.lastUsedAt),
    useCount: r.useCount,
    status: r.status as CacheStatus,
    staleAt: r.staleAt ? new Date(r.staleAt) : null,
    promotedAt: r.promotedAt ? new Date(r.promotedAt) : null,
    promotedBy: r.promotedBy,
    rejectedAt: r.rejectedAt ? new Date(r.rejectedAt) : null,
    rejectedBy: r.rejectedBy,
    rejectionReason: r.rejectionReason,
  }));
}

/**
 * Promote a cached profile (mark for curation)
 */
export async function promoteProfile(
  id: number,
  promotedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(researchedFitmentCache)
      .set({
        status: "promoted",
        promotedAt: new Date(),
        promotedBy,
      })
      .where(eq(researchedFitmentCache.id, id));
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Reject a cached profile
 */
export async function rejectProfile(
  id: number,
  rejectedBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(researchedFitmentCache)
      .set({
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy,
        rejectionReason: reason,
      })
      .where(eq(researchedFitmentCache.id, id));
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Refresh a stale profile (trigger background re-research)
 */
export async function markForRefresh(id: number): Promise<{ success: boolean }> {
  // For now, just reset the stale date to force a refresh on next lookup
  // A background worker could pick these up and re-research
  const staleDays = getStalePeriodDays();
  const newStaleAt = new Date(Date.now() + staleDays * 24 * 60 * 60 * 1000);
  
  await db
    .update(researchedFitmentCache)
    .set({
      staleAt: newStaleAt,
      updatedAt: new Date(),
    })
    .where(eq(researchedFitmentCache.id, id));
  
  return { success: true };
}

/**
 * Get profiles that need refresh (stale but still active)
 */
export async function getStaleProfiles(limit = 20): Promise<CachedResearchedFitment[]> {
  return listCachedProfiles({ status: "active", staleOnly: true, limit });
}

/**
 * Delete a cached profile
 */
export async function deleteCachedProfile(id: number): Promise<{ success: boolean }> {
  await db
    .delete(researchedFitmentCache)
    .where(eq(researchedFitmentCache.id, id));
  
  return { success: true };
}
