import { Redis } from '@upstash/redis';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

const CACHE_VERSION = "v2";
const KEY_PREFIX = `wt:fit:${CACHE_VERSION}:`;

// Staggered vehicles we need to clear
const vehicles = [
  // Dodge Challenger Widebody
  { year: 2023, make: 'dodge', model: 'challenger', modificationId: 'srt-hellcat-widebody' },
  { year: 2023, make: 'dodge', model: 'challenger', modificationId: 'srt hellcat widebody' },
  { year: 2023, make: 'dodge', model: 'challenger', modificationId: 'SRT Hellcat Widebody' },
  { year: 2023, make: 'dodge', model: 'challenger', modificationId: 'rt-scat-pack-widebody' },
  { year: 2023, make: 'dodge', model: 'challenger', modificationId: 'srt-hellcat-redeye-widebody' },
  
  // Chevrolet Camaro
  { year: 2024, make: 'chevrolet', model: 'camaro', modificationId: 'zl1' },
  { year: 2024, make: 'chevrolet', model: 'camaro', modificationId: 'zl1-1le' },
  { year: 2024, make: 'chevrolet', model: 'camaro', modificationId: 'ss' },
  { year: 2024, make: 'chevrolet', model: 'camaro', modificationId: 'ss-1le' },
  
  // Ford Mustang
  { year: 2024, make: 'ford', model: 'mustang', modificationId: 'dark-horse' },
  { year: 2024, make: 'ford', model: 'mustang', modificationId: 'gt-performance-pack' },
  { year: 2024, make: 'ford', model: 'mustang', modificationId: 'shelby-gt500' },
  { year: 2024, make: 'ford', model: 'mustang', modificationId: 'mach-1' },
];

function makeCacheKey(year, make, model, modificationId) {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim().replace(/\s+/g, "-");
  return `${KEY_PREFIX}${year}:${normalizedMake}:${normalizedModel}:${modificationId}`;
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

let deleted = 0;
let notFound = 0;

for (const v of vehicles) {
  const key = makeCacheKey(v.year, v.make, v.model, v.modificationId);
  try {
    const result = await redis.del(key);
    if (result > 0) {
      console.log(`✅ Deleted: ${key}`);
      deleted++;
    } else {
      // console.log(`⚪ Not found: ${key}`);
      notFound++;
    }
  } catch (e) {
    console.error(`❌ Error deleting ${key}:`, e.message);
  }
}

console.log(`\nSummary: ${deleted} deleted, ${notFound} not found`);
