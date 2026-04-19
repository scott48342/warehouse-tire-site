/**
 * Fetch Morimoto Ditch Kit Images
 * Maps our ditch kit SKUs to Morimoto product pages
 */

import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Map title patterns to Morimoto product page URLs
const PRODUCT_PAGES = {
  // Ditch kits by vehicle - expanded from search results
  'TACOMA 05': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Toyota-Tacoma-05-15',
  'TACOMA 16': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Toyota-Tacoma-16-23',
  'TUNDRA 07': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Toyota-Tundra-07-13',
  'TUNDRA 14': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Toyota-Tundra-14-21',
  'TUNDRA 22': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Toyota-Tundra-22',
  'RAM HD 19': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ram-HD-2019',
  'RAM 1500 19': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ram-1500-2019',
  'BRONCO 21': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ford-Bronco-2021',
  'BRONCO SPT': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ford-Bronco-Sport-2021',
  'DURANGO': 'https://www.morimotohid.com/Morimoto-2Banger-LED-Ditch-Light-System-Dodge-Durango-11-24_2',
  'F150 15': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ford-F150-15-20',
  'F150 21': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ford-F150-21-24',
  'SUPER DUTY': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ford-SuperDuty-17-22',
  'RANGER': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ford-Ranger-19-24',
  'SILVERADO 14': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Chevrolet-Silverado-14-18',
  'SILVERADO 19': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Chevrolet-Silverado-19-24',
  'SIERR 1500 19': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-GMC-Sierra-19-24',
  'SILV HD 20': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Chevrolet-Silverado-HD-20-24',
  'COLORADO 15': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Chevrolet-Colorado-15-23',
  'COLORADO 23': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Chevrolet-Colorado-23',
  'CANYON 15': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-GMC-Canyon-15-23',
  'CANYON 23': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-GMC-Canyon-23',
  'WRANGLER': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Jeep-Wrangler-JK-07-18',
  'JL JT': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Jeep-Wrangler-JL-JT-18',
  '4RUNNER 10': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Toyota-4Runner-10-24',
  'GLADIATOR': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Jeep-Gladiator-20-24',
  'CAYENNE': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Porsche-Cayenne-03-10',
  'MUSTANG 15': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Ford-Mustang-15-17',
  'GX 460': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Lexus-GX-460-10-24',
  'GX 470': 'https://www.morimotohid.com/2Banger-LED-A-Pillar-System-Lexus-GX-470-03-09',
};

// Extract image URL from page
async function fetchProductImage(url) {
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    
    // Look for main image pattern
    const match = html.match(/\/images\/Item%20Images\/(\d+)\.\d+\.jpg/);
    if (match) {
      return `https://www.morimotohid.com/images/Item%20Images/${match[1]}.010.jpg`;
    }
    
    // Alt pattern with double encoding
    const altMatch = html.match(/\/images\/Item%2520Images\/(\d+)\.\d+\.jpg/);
    if (altMatch) {
      return `https://www.morimotohid.com/images/Item%20Images/${altMatch[1]}.010.jpg`;
    }
    
    return null;
  } catch (e) {
    console.error(`Error fetching ${url}:`, e.message);
    return null;
  }
}

// Match title to product page
function findProductPage(title) {
  const t = title.toUpperCase();
  
  for (const [pattern, url] of Object.entries(PRODUCT_PAGES)) {
    if (t.includes(pattern)) {
      return url;
    }
  }
  return null;
}

async function main() {
  // Get ditch kits without images
  const result = await pool.query(`
    SELECT sku, title FROM accessories 
    WHERE brand = 'Morimoto Offroad' 
    AND (title ILIKE '%DITCH%' OR sku LIKE '2B-PLR-%')
    AND image_url IS NULL
    ORDER BY sku
  `);
  
  console.log(`Found ${result.rows.length} Morimoto ditch kits without images\n`);
  
  // Cache of fetched images by URL
  const imageCache = {};
  const updates = [];
  const unmatched = [];
  
  for (const row of result.rows) {
    const pageUrl = findProductPage(row.title);
    
    if (!pageUrl) {
      unmatched.push(row);
      continue;
    }
    
    // Check cache
    if (!imageCache[pageUrl]) {
      console.log(`[FETCH] ${pageUrl}`);
      imageCache[pageUrl] = await fetchProductImage(pageUrl);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    }
    
    const imageUrl = imageCache[pageUrl];
    if (imageUrl) {
      updates.push({ sku: row.sku, imageUrl });
      console.log(`[OK] ${row.sku} -> ${imageUrl.slice(-30)}`);
    } else {
      console.log(`[FAIL] ${row.sku} - No image found at ${pageUrl}`);
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Ready to update: ${updates.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  
  if (unmatched.length > 0) {
    console.log(`\nUnmatched titles (need manual mapping):`);
    unmatched.slice(0, 20).forEach(r => console.log(`  ${r.sku}: ${r.title}`));
  }
  
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
