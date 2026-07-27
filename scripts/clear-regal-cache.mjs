/**
 * Clear ALL Redis cache for Buick Regal
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Clear ALL Buick Regal keys
const patterns = [
  'wt:ymm:*buick*regal*',
  'wt:fitment:*buick*regal*', 
  'wt:profile:*buick*regal*',
  'fitment:*buick*regal*',
  '*:1984:buick:regal*',
  '*buick-regal*',
];

let totalDeleted = 0;

for (const pattern of patterns) {
  try {
    const keys = await redis.keys(pattern);
    console.log(`Pattern ${pattern}: ${keys.length} keys`);
    
    for (const key of keys) {
      const deleted = await redis.del(key);
      if (deleted) {
        console.log(`  Deleted: ${key}`);
        totalDeleted++;
      }
    }
  } catch (e) {
    console.log(`  Pattern ${pattern} error: ${e.message}`);
  }
}

// Also try specific keys
const specificKeys = [
  'wt:ymm:trims:1984:buick:regal',
  'fitment:1984:buick:regal',
  'wt:fitment:1984:buick:regal',
];

for (const key of specificKeys) {
  const deleted = await redis.del(key);
  if (deleted) {
    console.log(`Deleted specific: ${key}`);
    totalDeleted++;
  }
}

console.log(`\n✅ Total deleted: ${totalDeleted} keys`);
