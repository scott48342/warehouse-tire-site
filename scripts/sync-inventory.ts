#!/usr/bin/env npx tsx
/**
 * Standalone inventory sync script for GitHub Actions
 * 
 * Downloads WheelPros inventory feed via SFTP and caches to Upstash Redis.
 * Run manually: npx tsx scripts/sync-inventory.ts
 */

import Client from "ssh2-sftp-client";
import { Redis } from "@upstash/redis";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const SFTP_CONFIG = {
  host: process.env.WHEELPROS_SFTP_HOST || "sftp.wheelpros.com",
  port: 22,
  username: process.env.WHEELPROS_SFTP_USER || "Warehouse1",
  password: process.env.WHEELPROS_SFTP_PASS,
};

const FEED_PATH = "/CommonFeed/USD/WHEEL/wheelInvPriceData.json";
const REDIS_KEY_PREFIX = "inv:wheel:";
const REDIS_TTL_SECONDS = 60 * 60 * 4; // 4 hours

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type WheelInventoryRecord = {
  sku: string;
  inventoryType: string;
  totalQty: number;
  mapPrice: number | null;
  msrp: number | null;
  brand: string | null;
  style: string | null;
  runDate: string | null;
};

type RawFeedRecord = {
  PartNumber?: string;
  InvOrderType?: string;
  TotalQOH?: string | number;
  MAP_USD?: string;
  MSRP_USD?: string;
  Brand?: string;
  Style?: string;
  RunDate?: string;
  [key: string]: any;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SFTP DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════════════

async function downloadFeed(): Promise<Buffer> {
  const sftp = new Client();
  
  try {
    console.log("[sync] Connecting to SFTP...");
    await sftp.connect(SFTP_CONFIG);
    console.log("[sync] Connected");
    
    console.log("[sync] Downloading feed...");
    const data = await sftp.get(FEED_PATH) as Buffer;
    console.log(`[sync] Downloaded ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    
    return data;
  } finally {
    await sftp.end();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSE FEED
// ═══════════════════════════════════════════════════════════════════════════════

function parseFeed(data: Buffer): WheelInventoryRecord[] {
  const json: RawFeedRecord[] = JSON.parse(data.toString("utf8"));
  const records: WheelInventoryRecord[] = [];
  
  for (const row of json) {
    const partNumber = row.PartNumber;
    if (!partNumber) continue;
    
    const sku = partNumber.trim();
    const inventoryType = (row.InvOrderType || "").toUpperCase().trim();
    
    let totalQty = 0;
    if (typeof row.TotalQOH === "number") {
      totalQty = row.TotalQOH;
    } else if (typeof row.TotalQOH === "string") {
      totalQty = parseInt(row.TotalQOH, 10) || 0;
    }
    
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

async function cacheToRedis(records: WheelInventoryRecord[]): Promise<number> {
  // Support both Vercel KV naming and standard Upstash naming
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.log("[sync] Redis not configured, skipping cache");
    return 0;
  }
  
  const redis = new Redis({ url, token });
  
  // Build pipeline for batch insert
  const BATCH_SIZE = 500;
  let cached = 0;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const pipeline = redis.pipeline();
    
    for (const record of batch) {
      const key = `${REDIS_KEY_PREFIX}${record.sku}`;
      const value = JSON.stringify({
        type: record.inventoryType,
        qty: record.totalQty,
        map: record.mapPrice,
        msrp: record.msrp,
        brand: record.brand,
        style: record.style,
        run: record.runDate,
      });
      pipeline.setex(key, REDIS_TTL_SECONDS, value);
    }
    
    await pipeline.exec();
    cached += batch.length;
    
    if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= records.length) {
      console.log(`[sync] Cached ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} records`);
    }
  }
  
  // Store sync metadata
  await redis.set("inv:wheel:_meta", JSON.stringify({
    lastSync: new Date().toISOString(),
    recordCount: records.length,
    feedRunDate: records[0]?.runDate || null,
  }));
  
  return cached;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("WheelPros Inventory Sync");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const t0 = Date.now();
  
  // Validate config
  if (!SFTP_CONFIG.password) {
    console.error("[sync] ERROR: WHEELPROS_SFTP_PASS not set");
    process.exit(1);
  }
  
  try {
    // Download
    const data = await downloadFeed();
    
    // Parse
    console.log("[sync] Parsing feed...");
    const records = parseFeed(data);
    console.log(`[sync] Parsed ${records.length} records`);
    
    if (records.length > 0) {
      console.log(`[sync] Sample record:`, records[0]);
      console.log(`[sync] Feed run date: ${records[0].runDate}`);
    }
    
    // Cache
    const cached = await cacheToRedis(records);
    
    const durationMs = Date.now() - t0;
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`[sync] COMPLETE`);
    console.log(`[sync] Records processed: ${records.length}`);
    console.log(`[sync] Records cached: ${cached}`);
    console.log(`[sync] Duration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log("═══════════════════════════════════════════════════════════════");
    
  } catch (error) {
    console.error("[sync] FAILED:", error);
    process.exit(1);
  }
}

main();
