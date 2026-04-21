/**
 * Clear all fitment-related caches from Redis
 * Run: npx tsx scripts/clear-fitment-caches.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { Redis } from "@upstash/redis";

const PREFIXES = [
  "tiresearch:*",
  "ymm:*", 
  "fitment:*",
  "vehicle:*",
  "wheels:*",
];

async function clearCache() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.error("Redis not configured - missing env vars");
    process.exit(1);
  }
  
  const redis = new Redis({ url, token });
  
  console.log("Clearing fitment-related caches...\n");
  
  let grandTotal = 0;
  
  for (const prefix of PREFIXES) {
    console.log(`Scanning for ${prefix}...`);
    let cursor = 0;
    let prefixTotal = 0;
    
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: prefix,
        count: 100,
      });
      
      cursor = Number(nextCursor);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        prefixTotal += keys.length;
      }
    } while (cursor !== 0);
    
    console.log(`  Deleted ${prefixTotal} keys`);
    grandTotal += prefixTotal;
  }
  
  console.log(`\n✅ Done! Cleared ${grandTotal} total cache entries.`);
}

clearCache().catch(console.error);
