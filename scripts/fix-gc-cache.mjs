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

// Delete the bad cache entry
const key = 'wt:fit:2014:jeep:grand-cherokee:limited';

console.log(`Deleting cache key: ${key}`);
const result = await redis.del(key);
console.log(`Deleted: ${result === 1 ? 'YES' : 'NO'}`);

console.log('\nCache cleared! The next request for 2014 Grand Cherokee Limited');
console.log('will re-fetch from DB (which should use correct 71.5mm hub bore).');
