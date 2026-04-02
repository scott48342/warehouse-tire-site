/**
 * Missing Vehicle Logger
 * 
 * Tracks vehicles that users search for but have no fitment data.
 * This helps identify gaps in our coverage for prioritization.
 * 
 * Data is stored in Redis (Upstash) with a rolling 30-day window.
 * Each vehicle key stores: count, lastSeen, firstSeen, and sample paths.
 */

import { Redis } from "@upstash/redis";

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const MISSING_VEHICLE_PREFIX = "missing_vehicle:";
const MISSING_VEHICLE_SET = "missing_vehicles_set";
const TTL_DAYS = 30;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

export interface MissingVehicleEntry {
  year: number;
  make: string;
  model: string;
  trim?: string;
  count: number;
  firstSeen: string; // ISO timestamp
  lastSeen: string;  // ISO timestamp
  samplePaths: string[]; // URL paths where this was searched (max 5)
}

/**
 * Generate a normalized key for a vehicle
 */
function vehicleKey(year: number | string, make: string, model: string): string {
  const y = String(year).trim();
  const m = make.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
  const mo = model.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${MISSING_VEHICLE_PREFIX}${y}:${m}:${mo}`;
}

/**
 * Log a missing vehicle lookup
 * 
 * Called when a user searches for a vehicle that has no fitment profile.
 * This data is used to prioritize which vehicles to add to the database.
 */
export async function logMissingVehicle(
  year: number | string,
  make: string,
  model: string,
  options?: {
    trim?: string;
    path?: string; // URL path where this was searched
  }
): Promise<void> {
  // Skip if Redis is not configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log(`[missingVehicleLogger] Redis not configured, skipping log for ${year} ${make} ${model}`);
    return;
  }

  try {
    const key = vehicleKey(year, make, model);
    const now = new Date().toISOString();
    
    // Get existing entry
    const existing = await redis.get<MissingVehicleEntry>(key);
    
    if (existing) {
      // Update existing entry
      const samplePaths = existing.samplePaths || [];
      if (options?.path && !samplePaths.includes(options.path)) {
        samplePaths.push(options.path);
        if (samplePaths.length > 5) samplePaths.shift(); // Keep max 5
      }
      
      const updated: MissingVehicleEntry = {
        ...existing,
        count: existing.count + 1,
        lastSeen: now,
        samplePaths,
        trim: options?.trim || existing.trim,
      };
      
      await redis.set(key, updated, { ex: TTL_SECONDS });
    } else {
      // Create new entry
      const entry: MissingVehicleEntry = {
        year: Number(year),
        make: make.trim(),
        model: model.trim(),
        trim: options?.trim,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        samplePaths: options?.path ? [options.path] : [],
      };
      
      await redis.set(key, entry, { ex: TTL_SECONDS });
      
      // Add to the set of missing vehicles (for easy listing)
      await redis.sadd(MISSING_VEHICLE_SET, key);
    }
    
    console.log(`[missingVehicleLogger] Logged missing vehicle: ${year} ${make} ${model}${options?.trim ? ` (${options.trim})` : ""}`);
  } catch (err: any) {
    // Don't let logging errors break the main flow
    console.error(`[missingVehicleLogger] Failed to log missing vehicle:`, err?.message || err);
  }
}

/**
 * Get top missing vehicles by search count
 * 
 * Returns the most frequently searched vehicles that have no fitment data.
 * Useful for admin dashboards and prioritization.
 */
export async function getTopMissingVehicles(limit: number = 50): Promise<MissingVehicleEntry[]> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return [];
  }

  try {
    // Get all keys from the set
    const keys = await redis.smembers(MISSING_VEHICLE_SET);
    
    if (keys.length === 0) return [];
    
    // Fetch all entries (in batches if needed)
    const entries: MissingVehicleEntry[] = [];
    
    for (const key of keys) {
      const entry = await redis.get<MissingVehicleEntry>(key);
      if (entry) {
        entries.push(entry);
      } else {
        // Entry expired, remove from set
        await redis.srem(MISSING_VEHICLE_SET, key);
      }
    }
    
    // Sort by count (descending) and return top N
    return entries
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (err: any) {
    console.error(`[missingVehicleLogger] Failed to get top missing vehicles:`, err?.message || err);
    return [];
  }
}

/**
 * Clear a missing vehicle entry (e.g., after adding it to the database)
 */
export async function clearMissingVehicle(
  year: number | string,
  make: string,
  model: string
): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return;
  }

  try {
    const key = vehicleKey(year, make, model);
    await redis.del(key);
    await redis.srem(MISSING_VEHICLE_SET, key);
    console.log(`[missingVehicleLogger] Cleared missing vehicle entry: ${year} ${make} ${model}`);
  } catch (err: any) {
    console.error(`[missingVehicleLogger] Failed to clear missing vehicle:`, err?.message || err);
  }
}

export default {
  logMissingVehicle,
  getTopMissingVehicles,
  clearMissingVehicle,
};
