/**
 * Clear fitment profile cache for Buick Regal
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Fitment profile cache keys
const patterns = [
  'wt:fit:*buick*regal*',
  'wt:fit:1984:buick:regal:*',
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

// Also clear the specific new modificationId cache
const specificKey = 'wt:fit:1984:buick:regal:buick-regal-base-cad95b2f';
const deleted = await redis.del(specificKey);
if (deleted) {
  console.log(`Deleted specific: ${specificKey}`);
  totalDeleted++;
}

// List all wt:fit keys to see what's cached
const allFitKeys = await redis.keys('wt:fit:*');
console.log(`\nAll wt:fit cache keys: ${allFitKeys.length}`);
if (allFitKeys.length <= 20) {
  for (const k of allFitKeys) {
    console.log(`  ${k}`);
  }
}

console.log(`\n✅ Total deleted: ${totalDeleted} keys`);
