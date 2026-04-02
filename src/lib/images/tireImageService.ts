/**
 * Tire Image Service
 * 
 * Looks up tire images from our local cache (Vercel Blob) instead of
 * hitting external TireLibrary URLs directly.
 * 
 * Falls back to TireLibrary if not cached, and queues for import.
 */

import { db } from "@/lib/fitment-db";
import { tireImages } from "@/lib/fitment-db/schema";
import { eq, inArray } from "drizzle-orm";
import { getTireImage as getFallbackImage } from "./tireImageMap";

const TIRELIBRARY_BASE = "https://tireweb.tirelibrary.com/images/Products";

// In-memory cache for hot paths (reset on cold start)
const memoryCache = new Map<number, string | null>();
const MEMORY_CACHE_MAX = 5000;

/**
 * Get cached image URL for a TireLibrary pattern ID
 * Returns our Vercel Blob URL if cached, otherwise TireLibrary URL
 */
export async function getCachedTireImage(
  patternId: number | null | undefined,
  brand?: string | null,
  model?: string | null
): Promise<string> {
  // No patternId = use fallback map
  if (!patternId || patternId <= 0) {
    return getFallbackImage(null, brand, model);
  }

  // Check memory cache first
  if (memoryCache.has(patternId)) {
    const cached = memoryCache.get(patternId);
    if (cached) return cached;
    // null means not found/failed - fall through to TireLibrary
    return `${TIRELIBRARY_BASE}/${patternId}.jpg`;
  }

  try {
    // Check database
    const [record] = await db
      .select({ blobUrl: tireImages.blobUrl, status: tireImages.status })
      .from(tireImages)
      .where(eq(tireImages.patternId, patternId))
      .limit(1);

    if (record?.blobUrl && record.status === "uploaded") {
      // Cache hit - store in memory and return
      if (memoryCache.size < MEMORY_CACHE_MAX) {
        memoryCache.set(patternId, record.blobUrl);
      }
      return record.blobUrl;
    }

    if (record?.status === "not_found" || record?.status === "failed") {
      // Known bad - cache as null and return TireLibrary URL
      if (memoryCache.size < MEMORY_CACHE_MAX) {
        memoryCache.set(patternId, null);
      }
      return `${TIRELIBRARY_BASE}/${patternId}.jpg`;
    }

    // Not in our cache yet - queue for import (async, don't wait)
    queueForImport(patternId, brand, model).catch(() => {});

    // Return TireLibrary URL for now
    return `${TIRELIBRARY_BASE}/${patternId}.jpg`;
  } catch (err) {
    // DB error - fall back to TireLibrary
    console.error("[tireImageService] DB error:", err);
    return `${TIRELIBRARY_BASE}/${patternId}.jpg`;
  }
}

/**
 * Get cached images for multiple pattern IDs at once
 * Much more efficient than calling getCachedTireImage in a loop
 */
export async function getCachedTireImagesBatch(
  patternIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const toFetch: number[] = [];

  // Check memory cache first
  for (const id of patternIds) {
    if (memoryCache.has(id)) {
      const cached = memoryCache.get(id);
      result.set(id, cached || `${TIRELIBRARY_BASE}/${id}.jpg`);
    } else {
      toFetch.push(id);
    }
  }

  if (toFetch.length === 0) return result;

  try {
    // Batch fetch from database
    const records = await db
      .select({
        patternId: tireImages.patternId,
        blobUrl: tireImages.blobUrl,
        status: tireImages.status,
      })
      .from(tireImages)
      .where(inArray(tireImages.patternId, toFetch));

    const dbMap = new Map(records.map((r) => [r.patternId, r]));

    for (const id of toFetch) {
      const record = dbMap.get(id);

      if (record?.blobUrl && record.status === "uploaded") {
        result.set(id, record.blobUrl);
        if (memoryCache.size < MEMORY_CACHE_MAX) {
          memoryCache.set(id, record.blobUrl);
        }
      } else {
        // Not cached or failed - use TireLibrary
        result.set(id, `${TIRELIBRARY_BASE}/${id}.jpg`);
        if (
          memoryCache.size < MEMORY_CACHE_MAX &&
          (record?.status === "not_found" || record?.status === "failed")
        ) {
          memoryCache.set(id, null);
        }
      }
    }
  } catch (err) {
    console.error("[tireImageService] Batch fetch error:", err);
    // Fill with TireLibrary URLs
    for (const id of toFetch) {
      if (!result.has(id)) {
        result.set(id, `${TIRELIBRARY_BASE}/${id}.jpg`);
      }
    }
  }

  return result;
}

/**
 * Queue a pattern for import (non-blocking)
 */
async function queueForImport(
  patternId: number,
  brand?: string | null,
  model?: string | null
): Promise<void> {
  try {
    await db
      .insert(tireImages)
      .values({
        patternId,
        brand: brand || null,
        pattern: model || null,
        sourceUrl: `${TIRELIBRARY_BASE}/${patternId}.jpg`,
        status: "pending",
      })
      .onConflictDoNothing();
  } catch (err) {
    // Ignore - best effort
  }
}

/**
 * Clear memory cache (for testing/admin)
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}

/**
 * Get cache stats (for admin)
 */
export function getCacheStats(): {
  memorySize: number;
  memoryMax: number;
} {
  return {
    memorySize: memoryCache.size,
    memoryMax: MEMORY_CACHE_MAX,
  };
}
