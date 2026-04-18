import { config } from 'dotenv';
config({ path: '.env.local' });

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// The cache key format from ymmCache.ts
const cacheKey = "wt:ymm:trims:2023:jeep:cherokee";

console.log(`Deleting cache key: ${cacheKey}`);
const result = await redis.del(cacheKey);
console.log(`Delete result: ${result}`);

// Also clear any other Cherokee-related keys
const pattern = "wt:ymm:*:2023:jeep:cherokee*";
const keys = await redis.keys(pattern);
console.log(`Found keys matching ${pattern}:`, keys);

if (keys.length > 0) {
  for (const key of keys) {
    await redis.del(key);
    console.log(`Deleted: ${key}`);
  }
}

console.log('✅ Cache cleared for 2023 Jeep Cherokee');
