import { config } from 'dotenv';
config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Clear ALL fitment cache keys
const patterns = [
  'wt:fit:v1:*',
  'wt:fit:v2:*',
];

let totalDeleted = 0;

for (const pattern of patterns) {
  console.log(`Scanning pattern: ${pattern}`);
  
  let cursor = 0;
  let batchCount = 0;
  
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 500 });
    cursor = Number(nextCursor);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      totalDeleted += keys.length;
      batchCount++;
      console.log(`  Batch ${batchCount}: deleted ${keys.length} keys (total: ${totalDeleted})`);
    }
  } while (cursor !== 0);
}

console.log(`\n✅ Nuked ${totalDeleted} fitment cache keys`);
