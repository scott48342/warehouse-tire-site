/**
 * Wheel Availability Pre-Warm System
 * 
 * Pre-warms the SHARED availability cache for common vehicle searches.
 * Now uses Redis (Upstash) so pre-warm benefits ALL serverless instances.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE (Updated March 2026)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * BEFORE: Pre-warm only warmed ONE instance (wasted effort)
 * AFTER:  Pre-warm writes to SHARED Redis cache, benefits ALL instances
 * 
 * Production validation showed 0% pre-warm hit rate with instance-local cache.
 * Shared cache ensures pre-warm effort actually helps users.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * STRATEGY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 1. Target common truck/SUV bolt patterns (covers ~80% of truck/SUV traffic)
 * 2. Get candidate SKUs from techfeed index for each pattern
 * 3. Batch check availability with rate limiting
 * 4. Write results to SHARED Redis cache (30-minute TTL)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * TARGET VEHICLES (High-Frequency Searches)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Priority 1 - Half-ton trucks (highest volume):
 * - Ford F-150: 6x135 (87.1mm hub)
 * - Chevy Silverado 1500: 6x139.7 (78.1mm hub)
 * - Ram 1500: 5x139.7 (77.8mm hub)
 * 
 * Priority 2 - Heavy-duty trucks & SUVs (lifted/modified market):
 * - Ford F-250/F-350: 8x170 (124.9mm hub) ← CRITICAL for lifted searches
 * - Ram 2500/3500: 8x165.1 (121.3mm hub)
 * - Chevy/GMC 2500HD/3500HD: 8x180 (124.1mm hub)
 * - Jeep Wrangler: 5x127 (71.5mm hub)
 * - Toyota Tacoma: 6x139.7 (106.1mm hub)
 * - Chevy Tahoe/Suburban: 6x139.7 (78.1mm hub)
 * - GMC Sierra 1500: 6x139.7 (78.1mm hub)
 * 
 * Priority 3 - Additional coverage:
 * - Toyota Tundra: 5x150 (110.1mm hub)
 * - Jeep Grand Cherokee: 5x127 (71.6mm hub)
 * - Ford Bronco: 6x139.7 (93.1mm hub)
 * - Toyota 4Runner: 6x139.7 (106.1mm hub)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  setCacheBulk,
  recordPrewarmComplete,
  getCacheStats,
  getCacheStatsSync,
  ORDERABLE_TYPES,
} from "./availabilityCache";

import {
  getTechfeedCandidatesByBoltPattern,
  type TechfeedWheel,
} from "./techfeed/wheels";

import { getSupplierCredentials } from "./supplierCredentialsSecure";

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET VEHICLE PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

export type PrewarmTarget = {
  name: string;
  boltPattern: string;
  centerBore: number;
  priority: number; // 1 = highest priority
  description: string;
  // Optional: for lifted truck prewarming
  offsetRange?: { min: number; max: number };
  maxSkus?: number; // Override default max SKUs for this target
};

/**
 * High-frequency vehicle patterns for pre-warming.
 * Ordered by search volume/priority.
 * 
 * Priority 1: Top-selling half-ton trucks (F-150, Silverado 1500, Ram 1500)
 * Priority 2: Heavy-duty trucks + popular SUVs (F-250/F-350, Ram 2500/3500, Wrangler, etc.)
 * Priority 3: Additional coverage (Tundra, Grand Cherokee, etc.)
 */
export const PREWARM_TARGETS: PrewarmTarget[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Top-selling half-ton trucks
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Ford F-150",
    boltPattern: "6x135",
    centerBore: 87.1,
    priority: 1,
    description: "Best-selling truck in America",
  },
  {
    name: "Chevy Silverado 1500",
    boltPattern: "6x139.7",
    centerBore: 78.1,
    priority: 1,
    description: "#2 best-selling truck",
  },
  {
    name: "Ram 1500",
    boltPattern: "5x139.7",
    centerBore: 77.8,
    priority: 1,
    description: "#3 best-selling truck",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Heavy-duty trucks (lifted/modified market)
  // These are critical for lifted truck searches and HD vehicle coverage
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Ford F-250/F-350 Super Duty",
    boltPattern: "8x170",
    centerBore: 124.9,
    priority: 2,
    description: "Ford HD trucks - F-250, F-350, Super Duty (2017+)",
  },
  {
    name: "Ram 2500/3500",
    boltPattern: "8x165.1",
    centerBore: 121.3,
    priority: 2,
    description: "Ram HD trucks - 2500, 3500 (8x6.5 pattern)",
  },
  {
    name: "Chevy Silverado 2500HD/3500HD",
    boltPattern: "8x180",
    centerBore: 124.1,
    priority: 2,
    description: "Chevy/GMC HD trucks - 2500HD, 3500HD",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Lifted truck offset ranges (critical for lifted search perf)
  // These prewarm low-offset wheels specifically for lifted truck searches
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Ford F-250/F-350 Lifted (4-6\" lift)",
    boltPattern: "8x170",
    centerBore: 124.9,
    priority: 2,
    description: "Ford HD lifted: aggressive offset range",
    offsetRange: { min: -44, max: 0 },
    maxSkus: 300,
  },
  {
    name: "Ram 2500/3500 Lifted",
    boltPattern: "8x165.1",
    centerBore: 121.3,
    priority: 2,
    description: "Ram HD lifted: low offset wheels",
    offsetRange: { min: -44, max: 0 },
    maxSkus: 300,
  },
  {
    name: "Chevy/GMC 2500HD Lifted",
    boltPattern: "8x180",
    centerBore: 124.1,
    priority: 2,
    description: "Chevy HD lifted: low offset wheels",
    offsetRange: { min: -44, max: 0 },
    maxSkus: 300,
  },
  {
    name: "Ford F-150 Lifted",
    boltPattern: "6x135",
    centerBore: 87.1,
    priority: 2,
    description: "F-150 lifted: low offset wheels",
    offsetRange: { min: -24, max: 0 },
    maxSkus: 250,
  },
  
  {
    name: "Jeep Wrangler",
    boltPattern: "5x127",
    centerBore: 71.5,
    priority: 2,
    description: "High-customization SUV, lifted builds",
  },
  {
    name: "Toyota Tacoma",
    boltPattern: "6x139.7",
    centerBore: 106.1,
    priority: 2,
    description: "Best-selling mid-size truck",
  },
  {
    name: "Chevy Tahoe/Suburban",
    boltPattern: "6x139.7",
    centerBore: 78.1,
    priority: 2,
    description: "Full-size SUV platform",
  },
  {
    name: "GMC Sierra 1500",
    boltPattern: "6x139.7",
    centerBore: 78.1,
    priority: 2,
    description: "GMC truck platform",
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 3: Additional coverage
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Toyota Tundra",
    boltPattern: "5x150",
    centerBore: 110.1,
    priority: 3,
    description: "Full-size Toyota truck",
  },
  {
    name: "Jeep Grand Cherokee",
    boltPattern: "5x127",
    centerBore: 71.6,
    priority: 3,
    description: "Popular Jeep SUV",
  },
  {
    name: "Ford Bronco",
    boltPattern: "6x139.7",
    centerBore: 93.1,
    priority: 3,
    description: "Ford off-road SUV",
  },
  {
    name: "Toyota 4Runner",
    boltPattern: "6x139.7",
    centerBore: 106.1,
    priority: 3,
    description: "Toyota off-road SUV",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Max SKUs to check per bolt pattern (controls API load)
  MAX_SKUS_PER_PATTERN: 200,
  
  // Concurrency for availability checks (respect API rate limits)
  CONCURRENCY: 8,
  
  // Delay between batches (ms) - respect WheelPros rate limits
  BATCH_DELAY_MS: 100,
  
  // Timeout per SKU check (ms)
  SKU_TIMEOUT_MS: 1000,
  
  // Min qty to check for (standard 4-wheel order)
  MIN_QTY: 4,
  
  // Max total time for pre-warm job (ms)
  MAX_JOB_TIME_MS: 5 * 60 * 1000, // 5 minutes
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-WARM JOB
// ═══════════════════════════════════════════════════════════════════════════════

export type PrewarmResult = {
  success: boolean;
  duration: number;
  targetsProcessed: number;
  totalSkusChecked: number;
  totalSkusAvailable: number;
  totalSkusCached: number;
  targetResults: Array<{
    name: string;
    boltPattern: string;
    candidates: number;
    checked: number;
    available: number;
    cached: number;
    durationMs: number;
  }>;
  errors: string[];
  cacheStats: Awaited<ReturnType<typeof getCacheStats>>;
};

/**
 * Run the pre-warm job for all target patterns.
 */
export async function runPrewarmJob(options?: {
  targets?: PrewarmTarget[];
  maxSkusPerPattern?: number;
  concurrency?: number;
  dryRun?: boolean;
}): Promise<PrewarmResult> {
  const t0 = Date.now();
  const targets = options?.targets ?? PREWARM_TARGETS;
  const maxSkusPerPattern = options?.maxSkusPerPattern ?? CONFIG.MAX_SKUS_PER_PATTERN;
  const concurrency = options?.concurrency ?? CONFIG.CONCURRENCY;
  const dryRun = options?.dryRun ?? false;
  
  const result: PrewarmResult = {
    success: true,
    duration: 0,
    targetsProcessed: 0,
    totalSkusChecked: 0,
    totalSkusAvailable: 0,
    totalSkusCached: 0,
    targetResults: [],
    errors: [],
    cacheStats: getCacheStatsSync(), // Use sync version for initial state
  };
  
  // Get WheelPros credentials
  const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
  if (!wheelProsBase) {
    result.success = false;
    result.errors.push("Missing WHEELPROS_WRAPPER_URL or NEXT_PUBLIC_WHEELPROS_API_BASE_URL");
    result.duration = Date.now() - t0;
    return result;
  }
  
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.WHEELPROS_WRAPPER_API_KEY) {
    headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
  }
  
  let wpCreds: { customerNumber?: string; companyCode?: string };
  try {
    wpCreds = await getSupplierCredentials("wheelpros");
  } catch (e) {
    wpCreds = {};
  }
  
  // Sort targets by priority
  const sortedTargets = [...targets].sort((a, b) => a.priority - b.priority);
  
  // Process each target pattern
  for (const target of sortedTargets) {
    // Check time budget
    if (Date.now() - t0 > CONFIG.MAX_JOB_TIME_MS) {
      result.errors.push(`Time budget exceeded after ${result.targetsProcessed} targets`);
      break;
    }
    
    const targetT0 = Date.now();
    
    try {
      // Get candidates for this bolt pattern
      const candidates = await getTechfeedCandidatesByBoltPattern(target.boltPattern);
      
      // Use target-specific maxSkus or default
      const targetMaxSkus = target.maxSkus ?? maxSkusPerPattern;
      
      // Filter to valid-looking SKUs with pricing
      // Also filter by offset range if specified (for lifted truck prewarming)
      const validCandidates = candidates
        .filter((c) => {
          const price = Number(c.map_price || c.msrp || 0) || 0;
          if (!(price > 0 && c.sku)) return false;
          
          // If target has offset range, filter candidates by offset
          if (target.offsetRange) {
            const offset = c.offset != null ? Number(c.offset) : null;
            if (offset === null || !Number.isFinite(offset)) return false;
            if (offset < target.offsetRange.min || offset > target.offsetRange.max) return false;
          }
          
          return true;
        })
        .slice(0, targetMaxSkus);
      
      let checked = 0;
      let available = 0;
      let cached = 0;
      
      if (!dryRun) {
        // Collect results for bulk caching (more efficient with Redis)
        type AvailResult = {
          sku: string;
          ok: boolean;
          inventoryType: string;
          localQty: number;
          globalQty: number;
          checkedAt: string;
        };
        const batchResults: AvailResult[] = [];
        
        // Batch check availability with concurrency control
        const checkBatch = async (skus: TechfeedWheel[]): Promise<void> => {
          const results = await Promise.all(
            skus.map(async (c) => {
              try {
                const avail = await checkSkuAvailability({
                  wheelProsBase,
                  headers,
                  sku: c.sku,
                  minQty: CONFIG.MIN_QTY,
                  customerNumber: wpCreds.customerNumber,
                  companyCode: wpCreds.companyCode,
                });
                
                checked++;
                if (avail.ok) available++;
                
                return { sku: c.sku, ...avail };
              } catch (e) {
                // Log but don't fail the whole job
                console.warn(`[prewarm] SKU check failed: ${c.sku}`, e);
                return null;
              }
            })
          );
          
          // Collect non-null results
          for (const r of results) {
            if (r) batchResults.push(r);
          }
        };
        
        // Process in batches
        for (let i = 0; i < validCandidates.length; i += concurrency) {
          const batch = validCandidates.slice(i, i + concurrency);
          await checkBatch(batch);
          
          // Rate limiting delay between batches
          if (i + concurrency < validCandidates.length) {
            await new Promise((r) => setTimeout(r, CONFIG.BATCH_DELAY_MS));
          }
          
          // Check time budget during processing
          if (Date.now() - t0 > CONFIG.MAX_JOB_TIME_MS) {
            result.errors.push(`Time budget exceeded during ${target.name}`);
            break;
          }
        }
        
        // Bulk write all results to shared cache (efficient Redis pipeline)
        if (batchResults.length > 0) {
          const bulkResult = await setCacheBulk(
            batchResults.map((r) => ({
              sku: r.sku,
              minQty: CONFIG.MIN_QTY,
              result: {
                ok: r.ok,
                inventoryType: r.inventoryType,
                localQty: r.localQty,
                globalQty: r.globalQty,
                checkedAt: r.checkedAt,
              },
            })),
            { prewarmed: true }
          );
          cached = bulkResult.success;
          
          if (bulkResult.failed > 0) {
            console.warn(`[prewarm] ${bulkResult.failed} cache writes failed for ${target.name}`);
          }
        }
      } else {
        // Dry run - just count candidates
        checked = validCandidates.length;
      }
      
      result.targetResults.push({
        name: target.name,
        boltPattern: target.boltPattern,
        candidates: candidates.length,
        checked,
        available,
        cached,
        durationMs: Date.now() - targetT0,
      });
      
      result.targetsProcessed++;
      result.totalSkusChecked += checked;
      result.totalSkusAvailable += available;
      result.totalSkusCached += cached;
      
    } catch (e: any) {
      result.errors.push(`Target ${target.name} failed: ${e?.message || e}`);
    }
  }
  
  result.duration = Date.now() - t0;
  result.cacheStats = await getCacheStats();
  
  // Record completion for metrics
  if (!dryRun) {
    recordPrewarmComplete(result.duration, result.totalSkusCached);
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVAILABILITY CHECK (no-cache version for pre-warming)
// ═══════════════════════════════════════════════════════════════════════════════

async function checkSkuAvailability(opts: {
  wheelProsBase: string;
  headers: Record<string, string>;
  sku: string;
  minQty: number;
  customerNumber?: string;
  companyCode?: string;
}): Promise<{
  ok: boolean;
  inventoryType: string;
  localQty: number;
  globalQty: number;
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  const sku = String(opts.sku || "").trim();
  
  if (!sku) {
    return { ok: false, inventoryType: "", localQty: 0, globalQty: 0, checkedAt };
  }
  
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), CONFIG.SKU_TIMEOUT_MS);
  
  try {
    const u = new URL("/wheels/search", opts.wheelProsBase);
    u.searchParams.set("sku", sku);
    u.searchParams.set("page", "1");
    u.searchParams.set("pageSize", "1");
    u.searchParams.set("fields", "inventory");
    u.searchParams.set("customer", opts.customerNumber || "1022165");
    u.searchParams.set("company", opts.companyCode || "1000");
    u.searchParams.set("min_qty", String(opts.minQty));
    
    const res = await fetch(u.toString(), {
      headers: opts.headers,
      cache: "no-store",
      signal: ac.signal,
    });
    
    const data = await res.json().catch(() => null);
    const item = data?.results?.[0] || data?.items?.[0] || null;
    
    const inv = item?.inventory;
    const invObj = Array.isArray(inv) ? inv[0] : inv;
    const inventoryType = typeof invObj?.type === "string" ? invObj.type.trim().toUpperCase() : "";
    
    const localQty = Number(invObj?.localStock ?? invObj?.local_qty ?? invObj?.localQty ?? 0) || 0;
    const globalQty = Number(invObj?.globalStock ?? invObj?.global_qty ?? invObj?.globalQty ?? invObj?.quantity ?? 0) || 0;
    const total = localQty + globalQty;
    
    const ok = Boolean(inventoryType && ORDERABLE_TYPES.has(inventoryType) && total >= opts.minQty);
    
    return { ok, inventoryType, localQty, globalQty, checkedAt };
  } catch {
    return { ok: false, inventoryType: "", localQty: 0, globalQty: 0, checkedAt };
  } finally {
    clearTimeout(to);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED JOB RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

let prewarmInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the pre-warm scheduler.
 * Runs every 25 minutes (cache TTL is 30 min, so this keeps it warm).
 */
export function startPrewarmScheduler(intervalMs: number = 25 * 60 * 1000): void {
  if (prewarmInterval) {
    console.log("[prewarm] Scheduler already running");
    return;
  }
  
  console.log(`[prewarm] Starting scheduler with ${intervalMs}ms interval`);
  
  // Run immediately on start
  runPrewarmJobSafe();
  
  // Then run on interval
  prewarmInterval = setInterval(runPrewarmJobSafe, intervalMs);
}

/**
 * Stop the pre-warm scheduler.
 */
export function stopPrewarmScheduler(): void {
  if (prewarmInterval) {
    clearInterval(prewarmInterval);
    prewarmInterval = null;
    console.log("[prewarm] Scheduler stopped");
  }
}

/**
 * Run pre-warm job with safety wrapper.
 */
async function runPrewarmJobSafe(): Promise<void> {
  if (isRunning) {
    console.log("[prewarm] Job already running, skipping");
    return;
  }
  
  isRunning = true;
  console.log("[prewarm] Starting pre-warm job...");
  
  try {
    const result = await runPrewarmJob();
    console.log(`[prewarm] Completed in ${result.duration}ms:`, {
      targets: result.targetsProcessed,
      checked: result.totalSkusChecked,
      available: result.totalSkusAvailable,
      cached: result.totalSkusCached,
      errors: result.errors.length,
    });
  } catch (e) {
    console.error("[prewarm] Job failed:", e);
  } finally {
    isRunning = false;
  }
}

export function isPrewarmRunning(): boolean {
  return isRunning;
}

export function isSchedulerRunning(): boolean {
  return prewarmInterval !== null;
}
