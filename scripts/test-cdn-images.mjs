/**
 * Test whether all Wheel-1 CDN image URLs are accessible (HTTP 200)
 * and collect size stats. Run from project root.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Pull image1_source for ALL active SKUs (not just 20 — we want confidence on zero-placeholder claim)
const { rows } = await pool.query(`
  SELECT sku, brand, image1_source, image2_source, image3_source, image4_source
  FROM wheel1_products
  WHERE is_discontinued = FALSE
  ORDER BY brand, sku
`);
await pool.end();

console.log(`\nChecking image accessibility for all ${rows.length} SKUs...`);
console.log('(Sampling image1 for every SKU + image2/3/4 for first 5 per brand)\n');

// For every SKU check image1, for variety check multi-images on a sample
const toCheck = [];
const brandSeen = {};
for (const row of rows) {
  toCheck.push({ sku: row.sku, brand: row.brand, url: row.image1_source, slot: 1 });
  // Check extra angles for first 5 SKUs per brand
  if (!brandSeen[row.brand]) brandSeen[row.brand] = 0;
  if (brandSeen[row.brand] < 5) {
    if (row.image2_source) toCheck.push({ sku: row.sku, brand: row.brand, url: row.image2_source, slot: 2 });
    if (row.image3_source) toCheck.push({ sku: row.sku, brand: row.brand, url: row.image3_source, slot: 3 });
    if (row.image4_source) toCheck.push({ sku: row.sku, brand: row.brand, url: row.image4_source, slot: 4 });
    brandSeen[row.brand]++;
  }
}

console.log(`Total URLs to check: ${toCheck.length}`);

// Parallel batches of 20
const BATCH = 20;
let ok = 0, fail = 0, missing = 0;
const failures = [];
const sizes = [];

for (let i = 0; i < toCheck.length; i += BATCH) {
  const batch = toCheck.slice(i, i + BATCH);
  await Promise.all(batch.map(async ({ sku, brand, url, slot }) => {
    if (!url) { missing++; return; }
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        ok++;
        const kb = parseInt(res.headers.get('content-length') || '0') / 1024;
        if (kb > 0) sizes.push(kb);
      } else {
        fail++;
        if (failures.length < 10) failures.push({ sku, brand, slot, url: url.slice(0, 80), status: res.status });
      }
    } catch (e) {
      fail++;
      if (failures.length < 10) failures.push({ sku, brand, slot, url: url.slice(0, 80), error: e.message.slice(0, 50) });
    }
  }));

  if ((i + BATCH) % 200 === 0 || i + BATCH >= toCheck.length) {
    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, toCheck.length)}/${toCheck.length}  ok:${ok}  fail:${fail}  `);
  }
}

const avgKb = sizes.length ? Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length) : 0;
const totalMb = Math.round(sizes.reduce((a,b)=>a+b,0) / 1024);
// Extrapolate total for all 6033 images
const estTotalGb = (avgKb * 6033 / 1024 / 1024).toFixed(2);

console.log(`\n\n=== CDN IMAGE AUDIT ===`);
console.log(`Accessible (200):  ${ok}`);
console.log(`Failed:            ${fail}`);
console.log(`Missing URL:       ${missing}`);
console.log(`Zero placeholders: ${fail === 0 && missing === 0 ? '✅ YES' : '❌ NO'}`);
console.log(`Avg image size:    ${avgKb} KB`);
console.log(`Sample total:      ${totalMb} MB`);
console.log(`Est. full catalog: ~${estTotalGb} GB`);
if (failures.length) {
  console.log(`\nFirst failures:`);
  failures.forEach(f => console.log(' ', JSON.stringify(f)));
}

console.log(`\n=== NEXT.JS REMOTEPATTERNS ===`);
console.log('cdn.bfldr.com needs to be added to next.config.ts remotePatterns');
console.log('Without this, Next.js <Image> returns 400 even if URL is valid');
