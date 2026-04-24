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

// Petrol SKUs we know have good inventory in DB
const skus = [
  '1880P1C405115B76',  // $287, qoh=42
  'PE001BX18801540',   // $287, qoh=43
  'PE002SX18801540',   // $287, qoh=36
  '1880P5C405115B76',  // $294, qoh=40
  '1780P4C405115S76',  // qoh=72
];

(async () => {
  console.log('Checking Redis for Petrol inventory SKUs:\n');
  
  for (const sku of skus) {
    const key = `wt:inv:${sku}`;
    const value = await redis.get(key);
    if (value) {
      console.log(`${sku}: ${JSON.stringify(value)}`);
    } else {
      console.log(`${sku}: NOT IN REDIS`);
    }
  }
  
  // Check a known working SKU (Niche, etc.)
  console.log('\n--- Check a known working SKU ---');
  // Get some SKUs from search results
  const testSkus = [
    'M1172090F6+40',  // Random Niche SKU format
    'M117209044+40',
  ];
  
  // Let's scan for wt:inv:* keys
  console.log('\n--- Sample wt:inv:* keys ---');
  const keys = await redis.keys('wt:inv:*');
  console.log(`Total wt:inv:* keys: ${keys.length}`);
  
  // Show some samples
  const sampleKeys = keys.slice(0, 10);
  for (const k of sampleKeys) {
    const v = await redis.get(k);
    console.log(`  ${k}: ${JSON.stringify(v)}`);
  }
})();
