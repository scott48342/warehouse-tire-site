import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { Redis } = await import('@upstash/redis');

let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
url = url.replace(/^["']|["']$/g, '');
token = token.replace(/^["']|["']$/g, '');

if (!url || !token) {
  console.error('Missing Redis credentials');
  process.exit(1);
}

const redis = new Redis({ url, token });

// Check fitment cache for 2014 Grand Cherokee Limited
const key = 'wt:fit:2014:jeep:grand-cherokee:limited';
const val = await redis.get(key);

console.log('Cache key:', key);
console.log('Cached value:', val ? JSON.stringify(val, null, 2) : 'NOT FOUND');

// Also check for any Grand Cherokee fitment keys
console.log('\n--- Searching for Grand Cherokee fitment cache keys ---');
const keys = await redis.keys('wt:fit:*:jeep:grand-cherokee:*');
console.log(`Found ${keys.length} keys`);
if (keys.length > 0) {
  for (const k of keys.slice(0, 10)) {
    const v = await redis.get(k);
    console.log(`  ${k}: centerBoreMm=${v?.centerBoreMm}`);
  }
}
