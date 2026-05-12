/**
 * Clear YMM cache for a specific vehicle
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// The actual key format is: wt:ymm:trims:YEAR:MAKE:MODEL (lowercase, spaces→hyphens)
const key = 'wt:ymm:trims:2007:bmw:3-series';
const deleted = await redis.del(key);
console.log(`Deleted ${key}: ${deleted}`);

// Check for any BMW keys
const allBmwKeys = await redis.keys('wt:ymm:*bmw*');
console.log('\nAll BMW cache keys:', allBmwKeys);

// Delete all BMW trims cache
for (const k of allBmwKeys) {
  if (k.includes('trims')) {
    await redis.del(k);
    console.log(`Deleted: ${k}`);
  }
}

console.log('\n✅ Cache cleared');
