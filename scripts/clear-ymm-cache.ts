/**
 * Clear YMM (Year/Make/Model) cache in Redis
 * Run this after updating fitment data
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

async function main() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  console.log('Clearing YMM cache...\n');

  // Get all keys (paginated)
  let cursor = 0;
  let totalDeleted = 0;
  const patterns = ['ymm:*', 'models:*', 'makes:*', 'years:*', 'trims:*'];
  
  for (const pattern of patterns) {
    console.log(`Scanning for ${pattern}...`);
    let keysFound = 0;
    
    do {
      const result = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      const keys = result[1];
      
      if (keys.length > 0) {
        keysFound += keys.length;
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } while (cursor !== 0);
    
    console.log(`  Found and deleted: ${keysFound} keys`);
  }

  console.log(`\nTotal cache keys deleted: ${totalDeleted}`);
  console.log('Cache cleared successfully!');
}

main().catch(console.error);
