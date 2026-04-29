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
// Strip any surrounding quotes from env vars
url = url.replace(/^["']|["']$/g, '');
token = token.replace(/^["']|["']$/g, '');

if (!url || !token) {
  console.error('Missing Redis credentials');
  process.exit(1);
}

const redis = new Redis({ url, token });

const sku = process.argv[2] || 'FC403PB20905001';
const key = `wt:inv:${sku}`;

console.log(`Checking inventory for SKU: ${sku}`);
console.log(`Redis key: ${key}\n`);

const value = await redis.get(key);
if (value) {
  console.log('✅ FOUND in inventory cache:');
  console.log(JSON.stringify(value, null, 2));
} else {
  console.log('❌ NOT FOUND in inventory cache');
  console.log('\nThis wheel will be filtered out of fitment search results.');
  console.log('The SFTP feed may not include this SKU.');
  
  // Check for similar FC403 SKUs
  console.log('\n--- Searching for similar FC403* SKUs ---');
  const keys = await redis.keys('wt:inv:FC403*');
  console.log(`Found ${keys.length} FC403* SKUs in cache`);
  if (keys.length > 0) {
    for (const k of keys.slice(0, 5)) {
      const v = await redis.get(k);
      console.log(`  ${k.replace('wt:inv:', '')}: qty=${v?.totalQty}, type=${v?.inventoryType}`);
    }
    if (keys.length > 5) console.log(`  ... and ${keys.length - 5} more`);
  }
}
