/**
 * Clear all tire search cache from Redis
 * Run: npx tsx scripts/clear-tire-cache.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { Redis } from "@upstash/redis";

async function clearCache() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.error("Redis not configured - missing env vars");
    process.exit(1);
  }
  
  const redis = new Redis({ url, token });
  
  console.log("Clearing tire search cache...");
  
  let cursor = 0;
  let totalDeleted = 0;
  
  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: "tiresearch:*",
      count: 100,
    });
    
    cursor = Number(nextCursor);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      totalDeleted += keys.length;
      console.log(`Deleted ${keys.length} keys (total: ${totalDeleted})`);
    }
  } while (cursor !== 0);
  
  console.log(`\n✅ Done! Cleared ${totalDeleted} cache entries.`);
}

clearCache().catch(console.error);
