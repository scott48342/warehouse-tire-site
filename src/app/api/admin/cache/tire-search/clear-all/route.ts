/**
 * Admin API: Clear ALL tire search cache
 * GET /api/admin/cache/tire-search/clear-all
 * 
 * Clears all tiresearch:* keys from Redis.
 * Use with caution - will cause cache miss storm on next requests.
 */
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET() {
  const redis = getRedis();
  
  if (!redis) {
    return NextResponse.json({
      success: false,
      error: "Redis not configured",
    }, { status: 500 });
  }
  
  try {
    // Scan for all tiresearch:* keys and delete them
    let cursor = 0;
    let totalDeleted = 0;
    const batchSize = 100;
    
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: "tiresearch:*",
        count: batchSize,
      });
      
      cursor = Number(nextCursor);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
        console.log(`[cache/clear-all] Deleted ${keys.length} keys`);
      }
    } while (cursor !== 0);
    
    console.log(`[cache/clear-all] Total deleted: ${totalDeleted} keys`);
    
    return NextResponse.json({
      success: true,
      keysDeleted: totalDeleted,
      message: `Cleared ${totalDeleted} tire search cache entries`,
    });
  } catch (err: any) {
    console.error("[cache/clear-all] Error:", err);
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}
