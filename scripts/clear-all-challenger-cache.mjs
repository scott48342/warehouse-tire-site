import { config } from 'dotenv';
config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Clear ALL Challenger cache keys
const patterns = [
  'wt:fit:v2:2023:dodge:challenger:*',
  'wt:fit:v1:2023:dodge:challenger:*',
];

for (const pattern of patterns) {
  console.log(`Clearing pattern: ${pattern}`);
  
  let cursor = 0;
  let deleted = 0;
  
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(nextCursor);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
      console.log(`  Deleted ${keys.length} keys (cursor: ${cursor})`);
    }
  } while (cursor !== 0);
  
  console.log(`  Total deleted for ${pattern}: ${deleted}`);
}

console.log('Done!');
