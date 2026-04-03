/**
 * Inventory Sync from WheelPros SFTP Feed
 * 
 * Downloads the wheelInvPriceData.json feed every 2 hours and caches
 * inventory data (type + quantity) for all wheel SKUs.
 * 
 * Feed location: sftp://sftp.wheelpros.com/CommonFeed/USD/WHEEL/wheelInvPriceData.json
 * Feed size: ~38MB, ~50k+ SKUs
 * Feed refresh: Every 2 hours by WheelPros
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Redis } from "@upstash/redis";

// Dynamic import to avoid Turbopack bundling issues with ssh2 native modules
async function getSftpClient() {
  const { default: Client } = await import("ssh2-sftp-client");
  return new Client();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WheelInventoryRecord = {
  sku: string;
  inventoryType: string;
  totalQty: number;
  mapPrice: number | null;
  msrp: number | null;
  brand: string | null;
  style: string | null;
  runDate: string | null;
};

export type SyncResult = {
  success: boolean;
  recordsProcessed: number;
  recordsCached: number;
  errors: string[];
  durationMs: number;
  feedRunDate: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const SFTP_CONFIG = {
  host: "sftp.wheelpros.com",
  port: 22,
  username: process.env.WHEELPROS_SFTP_USER || "Warehouse1",
  password: process.env.WHEELPROS_SFTP_PASS || "",
};

const FEED_PATH = "/CommonFeed/USD/WHEEL/wheelInvPriceData.json";

// Cache TTL: 3 hours (feed updates every 2 hours, give buffer)
const CACHE_TTL_SECONDS = 3 * 60 * 60;

// Redis key prefix for inventory data
const CACHE_KEY_PREFIX = "wt:inv:";

// ═══════════════════════════════════════════════════════════════════════════════
// SFTP DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

async function downloadInventoryFeed(): Promise<Buffer> {
  const sftp = await getSftpClient();
  
  try {
    await sftp.connect(SFTP_CONFIG);
    console.log("[inventorySync] Connected to SFTP");
    
    const data = await sftp.get(FEED_PATH) as Buffer;
    console.log(`[inventorySync] Downloaded ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    
    return data;
  } finally {
    await sftp.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSE FEED
// ═══════════════════════════════════════════════════════════════════════════════

type RawFeedRecord = {
  PartNumber?: string;
  InvOrderType?: string;
  TotalQOH?: string | number;
  MAP_USD?: string;
  MSRP_USD?: string;
  Brand?: string;
  Style?: string;
  RunDate?: string;
  [key: string]: any; // Warehouse quantities
};

function normalizePartNumber(partNumber: string): string {
  // Most SKUs are already in public format (MO97081067324NRC, KM23579063538N, etc.)
  // Some internal SKUs have leading zeros: "000000000001058059" → keep as-is for now
  // The techfeed uses the same SKU format as the WheelPros API
  return partNumber.trim();
}

function parseInventoryFeed(data: Buffer): WheelInventoryRecord[] {
  const json: RawFeedRecord[] = JSON.parse(data.toString("utf8"));
  const records: WheelInventoryRecord[] = [];
  
  for (const row of json) {
    const partNumber = row.PartNumber;
    if (!partNumber) continue;
    
    const sku = normalizePartNumber(partNumber);
    const inventoryType = (row.InvOrderType || "").toUpperCase().trim();
    
    // Parse total quantity
    let totalQty = 0;
    if (typeof row.TotalQOH === "number") {
      totalQty = row.TotalQOH;
    } else if (typeof row.TotalQOH === "string") {
      totalQty = parseInt(row.TotalQOH, 10) || 0;
    }
    
    // Parse prices
    const mapPrice = row.MAP_USD ? parseFloat(row.MAP_USD) || null : null;
    const msrp = row.MSRP_USD ? parseFloat(row.MSRP_USD) || null : null;
    
    records.push({
      sku,
      inventoryType,
      totalQty,
      mapPrice,
      msrp,
      brand: row.Brand || null,
      style: row.Style || null,
      runDate: row.RunDate || null,
    });
  }
  
  return records;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE TO REDIS
// ═══════════════════════════════════════════════════════════════════════════════

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.warn("[inventorySync] Redis not configured");
    return null;
  }
  
  return new Redis({ url, token });
}

async function cacheInventoryData(records: WheelInventoryRecord[]): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  
  // Build pipeline for bulk set
  const pipeline = redis.pipeline();
  let count = 0;
  
  for (const record of records) {
    const key = `${CACHE_KEY_PREFIX}${record.sku}`;
    const value = JSON.stringify({
      t: record.inventoryType,  // type
      q: record.totalQty,       // quantity
      m: record.msrp,           // msrp
      p: record.mapPrice,       // map price
      u: Date.now(),            // updated at
    });
    
    pipeline.set(key, value, { ex: CACHE_TTL_SECONDS });
    count++;
    
    // Execute in batches of 1000 to avoid memory issues
    if (count % 1000 === 0) {
      await pipeline.exec();
    }
  }
  
  // Execute remaining
  await pipeline.exec();
  
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET CACHED INVENTORY (for use by wheel search)
// ═══════════════════════════════════════════════════════════════════════════════

export type CachedInventory = {
  inventoryType: string;
  totalQty: number;
  msrp: number | null;
  cachedAt: number;
};

export async function getInventoryForSku(sku: string): Promise<CachedInventory | null> {
  const redis = getRedis();
  if (!redis) return null;
  
  const key = `${CACHE_KEY_PREFIX}${sku}`;
  const value = await redis.get<string>(key);
  
  if (!value) return null;
  
  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    return {
      inventoryType: data.t || "UNKNOWN",
      totalQty: data.q || 0,
      msrp: data.m || null,
      cachedAt: data.u || 0,
    };
  } catch {
    return null;
  }
}

export async function getInventoryBulk(skus: string[]): Promise<Map<string, CachedInventory>> {
  const result = new Map<string, CachedInventory>();
  const redis = getRedis();
  if (!redis || skus.length === 0) return result;
  
  const keys = skus.map((sku) => `${CACHE_KEY_PREFIX}${sku}`);
  const values = await redis.mget<string[]>(...keys);
  
  for (let i = 0; i < skus.length; i++) {
    const value = values[i];
    if (!value) continue;
    
    try {
      const data = typeof value === "string" ? JSON.parse(value) : value;
      result.set(skus[i], {
        inventoryType: data.t || "UNKNOWN",
        totalQty: data.q || 0,
        msrp: data.m || null,
        cachedAt: data.u || 0,
      });
    } catch {
      // Skip invalid entries
    }
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SYNC FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function runInventorySync(): Promise<SyncResult> {
  const t0 = Date.now();
  const result: SyncResult = {
    success: false,
    recordsProcessed: 0,
    recordsCached: 0,
    errors: [],
    durationMs: 0,
    feedRunDate: null,
  };
  
  try {
    // Check SFTP password is configured
    if (!SFTP_CONFIG.password) {
      throw new Error("WHEELPROS_SFTP_PASS not configured");
    }
    
    // Download feed
    console.log("[inventorySync] Downloading feed from SFTP...");
    const data = await downloadInventoryFeed();
    
    // Parse feed
    console.log("[inventorySync] Parsing feed...");
    const records = parseInventoryFeed(data);
    result.recordsProcessed = records.length;
    result.feedRunDate = records[0]?.runDate || null;
    
    console.log(`[inventorySync] Parsed ${records.length} records`);
    
    // Cache to Redis
    console.log("[inventorySync] Caching to Redis...");
    result.recordsCached = await cacheInventoryData(records);
    
    console.log(`[inventorySync] Cached ${result.recordsCached} records`);
    
    result.success = true;
  } catch (err: any) {
    console.error("[inventorySync] Sync failed:", err);
    result.errors.push(err?.message || String(err));
  }
  
  result.durationMs = Date.now() - t0;
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC STATUS
// ═══════════════════════════════════════════════════════════════════════════════

let lastSyncResult: SyncResult | null = null;

export function getLastSyncResult(): SyncResult | null {
  return lastSyncResult;
}

export async function runInventorySyncAndStore(): Promise<SyncResult> {
  lastSyncResult = await runInventorySync();
  return lastSyncResult;
}
