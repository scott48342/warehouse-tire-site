/**
 * Fetch Gorilla Automotive images from their website
 * Maps our SKUs (zero-padded) to their product page URLs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Convert our zero-padded SKU to Gorilla's format
function skuToGorillaUrl(sku) {
  // Remove leading zeros
  const trimmed = sku.replace(/^0+/, '');
  // Build URL - their pattern is /gorilla-automotive-{sku}
  return `https://www.gorilla-auto.com/gorilla-automotive-${trimmed.toLowerCase()}`;
}

// Fetch product page and extract main image
async function fetchProductImage(url) {
  try {
    const resp = await fetch(url, { timeout: 10000 });
    if (resp.status !== 200) return null;
    
    const html = await resp.text();
    
    // Look for OG image (most reliable)
    const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (ogMatch) return ogMatch[1];
    
    // Look for main product image in catalog path
    const catalogMatch = html.match(/https:\/\/www\.gorilla-auto\.com\/media\/catalog\/product\/[^"']+\.(jpg|png)/i);
    if (catalogMatch) return catalogMatch[0];
    
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  // Get Gorilla products without images
  const result = await pool.query(`
    SELECT sku, title FROM accessories 
    WHERE brand = 'Gorilla Automotive' 
    AND image_url IS NULL
    ORDER BY sku
    LIMIT 100
  `);
  
  console.log(`Testing ${result.rows.length} Gorilla products...\n`);
  
  const updates = [];
  let found = 0;
  let notFound = 0;
  
  for (const row of result.rows) {
    const url = skuToGorillaUrl(row.sku);
    const imageUrl = await fetchProductImage(url);
    
    if (imageUrl) {
      updates.push({ sku: row.sku, imageUrl });
      found++;
      console.log(`[OK] ${row.sku} -> ${imageUrl.slice(-40)}`);
    } else {
      notFound++;
      if (notFound <= 5) console.log(`[MISS] ${row.sku} - ${url}`);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Found: ${found}`);
  console.log(`Not found: ${notFound}`);
  
  if (updates.length > 0) {
    console.log(`\nApplying ${updates.length} updates...`);
    for (const u of updates) {
      await pool.query(
        `UPDATE accessories SET image_url = $1 WHERE sku = $2`,
        [u.imageUrl, u.sku]
      );
    }
    console.log('Done!');
  }
  
  await pool.end();
}

main().catch(console.error);
