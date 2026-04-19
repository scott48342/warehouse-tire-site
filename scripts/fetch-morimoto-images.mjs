/**
 * Fetch Morimoto Light Bar Images
 * Maps our SKUs to Morimoto product pages and downloads images
 */

import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

// Load env
const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Morimoto product page URLs mapped to product types
// These are the "parent" products - variants use same images
const PRODUCT_PAGES = {
  // 2Banger Bars (single row)
  '2BANGER_4POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-4-Pod-16in',
  '2BANGER_6POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-6-Pod-24in',
  '2BANGER_8POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-8-Pod-31.5in',
  '2BANGER_10POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-10-Pod-40in',
  '2BANGER_12POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-12-Pod-47in',
  
  // 4Banger Bars (dual row)  
  '4BANGER_4POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-4-Pod-16in_2',
  '4BANGER_6POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-6-Pod-24in_2',
  '4BANGER_8POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-8-Pod-31.5in_2',
  '4BANGER_10POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-10-Pod-40in_2',
  '4BANGER_12POD': 'https://www.morimotohid.com/Single-Row-BangerBar-Off-Road-LED-Light-Bar-12-Pod-47in_2',
  
  // BigBanger Bars (triple row)
  'BIGBANGER_4POD': 'https://www.morimotohid.com/Triple-Row-BangerBar-Off-Road-LED-Light-Bar-4-Pod-29in',
  'BIGBANGER_5POD': 'https://www.morimotohid.com/Triple-Row-BangerBar-Off-Road-LED-Light-Bar-5-Pod-36in',
  'BIGBANGER_6POD': 'https://www.morimotohid.com/Triple-Row-BangerBar-Off-Road-LED-Light-Bar-6-Pod-43in',
  'BIGBANGER_7POD': 'https://www.morimotohid.com/Triple-Row-BangerBar-Off-Road-LED-Light-Bar-7-Pod-50.5in',
  
  // Vehicle-specific kits
  'BRONCO_2BANGER': 'https://www.morimotohid.com/2021-Bronco-2Banger-Light-Bar-System-Morimoto',
  'BRONCO_4BANGER': 'https://www.morimotohid.com/2021-Bronco-4Banger-Light-Bar-System-Morimoto',
  'BRONCO_BIGBANGER': 'https://www.morimotohid.com/2021-Bronco-BigBanger-Light-Bar-System-Morimoto',
  'JEEP_2BANGER': 'https://www.morimotohid.com/2018-Wrangler-JL-2Banger-Light-Bar-System-Morimoto',
  'JEEP_4BANGER': 'https://www.morimotohid.com/2018-Wrangler-JL-4Banger-Light-Bar-System-Morimoto',
  'JEEP_BIGBANGER': 'https://www.morimotohid.com/2018-Wrangler-JL-BigBanger-Light-Bar-System-Morimoto',
};

// Map SKU patterns to product types
function getProductType(sku, title) {
  const t = title.toUpperCase();
  
  // Vehicle-specific
  if (t.includes('BRONCO')) {
    if (t.includes('BIGBANGER')) return 'BRONCO_BIGBANGER';
    if (t.includes('4BANGER')) return 'BRONCO_4BANGER';
    if (t.includes('2BANGER')) return 'BRONCO_2BANGER';
  }
  if (t.includes('JEEP') || t.includes('JL JT')) {
    if (t.includes('BIGBANGER')) return 'JEEP_BIGBANGER';
    if (t.includes('4BANGER')) return 'JEEP_4BANGER';
    if (t.includes('2BANGER')) return 'JEEP_2BANGER';
  }
  
  // Pod count extraction
  const podMatch = t.match(/(\d+)POD/);
  const podCount = podMatch ? podMatch[1] : null;
  
  // BigBanger (triple row)
  if (t.includes('BIGBANGER') || sku.includes('3ROW')) {
    return `BIGBANGER_${podCount}POD`;
  }
  // 4Banger (dual row)
  if (t.includes('4BANGER') || sku.includes('2ROW')) {
    return `4BANGER_${podCount}POD`;
  }
  // 2Banger (single row)
  if (t.includes('2BANGER') || sku.includes('1ROW')) {
    return `2BANGER_${podCount}POD`;
  }
  
  return null;
}

// Fetch product page and extract image URL
async function fetchProductImage(url) {
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    
    // Extract image URL pattern: /images/Item%20Images/{id}.010.jpg
    const match = html.match(/https:\/\/www\.morimotohid\.com\/images\/Item%20Images\/(\d+)\.010\.jpg/);
    if (match) {
      return match[0].replace('%20', ' ');
    }
    
    // Try alternate pattern
    const altMatch = html.match(/\/images\/Item Images\/(\d+)\.\d+\.jpg/);
    if (altMatch) {
      return `https://www.morimotohid.com/images/Item%20Images/${altMatch[1]}.010.jpg`;
    }
    
    return null;
  } catch (e) {
    console.error(`Error fetching ${url}:`, e.message);
    return null;
  }
}

async function main() {
  // Get light bars without images
  const result = await pool.query(`
    SELECT sku, title, brand, image_url 
    FROM accessories 
    WHERE (sub_type = 'light_bar' OR title ILIKE '%light bar%' OR title ILIKE '%bangerbar%' OR title ILIKE '%banger bar%')
    AND image_url IS NULL
    AND brand = 'Morimoto Offroad'
    ORDER BY title
  `);
  
  console.log(`Found ${result.rows.length} Morimoto light bars without images\n`);
  
  // Cache of fetched images by product type
  const imageCache = {};
  
  // Process each SKU
  const updates = [];
  
  for (const row of result.rows) {
    const productType = getProductType(row.sku, row.title);
    
    if (!productType) {
      console.log(`[SKIP] ${row.sku} - Could not determine product type: ${row.title}`);
      continue;
    }
    
    const pageUrl = PRODUCT_PAGES[productType];
    if (!pageUrl) {
      console.log(`[SKIP] ${row.sku} - No page URL for type: ${productType}`);
      continue;
    }
    
    // Check cache
    if (!imageCache[productType]) {
      console.log(`[FETCH] ${productType} from ${pageUrl}`);
      imageCache[productType] = await fetchProductImage(pageUrl);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }
    
    const imageUrl = imageCache[productType];
    if (imageUrl) {
      updates.push({ sku: row.sku, imageUrl });
      console.log(`[OK] ${row.sku} -> ${imageUrl.slice(0, 60)}...`);
    } else {
      console.log(`[FAIL] ${row.sku} - No image found for ${productType}`);
    }
  }
  
  console.log(`\n\nReady to update ${updates.length} products`);
  
  // Apply updates
  if (updates.length > 0) {
    console.log('\nApplying updates...');
    for (const u of updates) {
      await pool.query(
        `UPDATE accessories SET image_url = $1 WHERE sku = $2`,
        [u.imageUrl, u.sku]
      );
    }
    console.log(`Updated ${updates.length} products with images!`);
  }
  
  await pool.end();
}

main().catch(console.error);
