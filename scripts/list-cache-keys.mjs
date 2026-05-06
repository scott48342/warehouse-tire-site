import { config } from 'dotenv';
config({ path: '.env.local' });

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Scan for all fitment cache keys matching Challenger
console.log('Scanning for Challenger cache keys...');

let cursor = 0;
const pattern = 'wt:fit:v2:2023:dodge:challenger:*';
const allKeys = [];

do {
  const result = await redis.scan(cursor, { match: pattern, count: 100 });
  cursor = result[0];
  allKeys.push(...result[1]);
} while (cursor !== 0);

console.log(`Found ${allKeys.length} keys:`);
for (const key of allKeys) {
  const value = await redis.get(key);
  console.log(`\n${key}:`);
  console.log(`  oemWheelSizes count: ${value?.oemWheelSizes?.length || 'N/A'}`);
  if (value?.oemWheelSizes) {
    console.log(`  widths: ${value.oemWheelSizes.map(w => w.width).join(', ')}`);
  }
}
