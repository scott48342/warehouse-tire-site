/**
 * Clear YMM cache for Buick Regal
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Find all Buick Regal cache keys
const regalKeys = await redis.keys('wt:ymm:*buick*regal*');
console.log(`Found ${regalKeys.length} Buick Regal cache keys:`);

for (const k of regalKeys) {
  const deleted = await redis.del(k);
  console.log(`  Deleted: ${k} (${deleted})`);
}

console.log('\n✅ Buick Regal cache cleared');
