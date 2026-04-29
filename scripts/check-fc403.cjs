const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const sku = 'FC403PB20905001';

(async () => {
  console.log(`Checking FC403 BURN wheel SKU: ${sku}\n`);
  
  // Check exact SKU
  const key = `wt:inv:${sku}`;
  const value = await redis.get(key);
  console.log(`${sku}: ${value ? JSON.stringify(value) : 'NOT IN REDIS CACHE'}`);
  
  // Check for any FC403 SKUs
  console.log('\n--- Searching for any FC403* SKUs ---');
  const keys = await redis.keys('wt:inv:FC403*');
  console.log(`FC403* keys found: ${keys.length}`);
  if (keys.length > 0) {
    for (const k of keys.slice(0, 10)) {
      const v = await redis.get(k);
      console.log(`  ${k}: ${JSON.stringify(v)}`);
    }
  }
  
  // Also check for any BURN wheels (might be different style code)
  console.log('\n--- Searching for BURN keyword in keys ---');
  // Redis KEYS doesn't support pattern with BURN mid-string easily
  // Let's just check a few Fuel 1PC patterns
  const fuelPatterns = await redis.keys('wt:inv:FC*');
  console.log(`FC* (Fuel 1PC) keys found: ${fuelPatterns.length}`);
  if (fuelPatterns.length > 0 && fuelPatterns.length < 50) {
    for (const k of fuelPatterns) {
      console.log(`  ${k}`);
    }
  } else if (fuelPatterns.length >= 50) {
    console.log(`  (showing first 20)`);
    for (const k of fuelPatterns.slice(0, 20)) {
      console.log(`  ${k}`);
    }
  }
})();
