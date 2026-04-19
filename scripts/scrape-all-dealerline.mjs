/**
 * Automated DealerLine image scraper using fetch
 * Scrapes the search API directly
 */

import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Brand search terms
const BRANDS = [
  { name: 'Gorilla Automotive', search: 'gorilla' },
  { name: 'Fox Shocks', search: 'fox+shocks' },
  { name: 'Bilstein', search: 'bilstein' },
  { name: 'Teraflex', search: 'teraflex' },
  { name: 'GTR Lighting', search: 'gtr+lighting' },
];

const allImages = {};

async function scrapeBrand(brand) {
  console.log(`\n=== Scraping ${brand.name} ===`);
  
  const baseUrl = 'https://dl.wheelpros.com/us_en/ymm/search/';
  let page = 1;
  let hasMore = true;
  let totalFound = 0;
  
  while (hasMore && page <= 50) { // Max 50 pages
    const url = `${baseUrl}?api-type=products&min_qty=1&pageSize=100&q=${brand.search}&p=${page}`;
    
    try {
      const resp = await fetch(url);
      const html = await resp.text();
      
      // Extract image URLs from HTML
      const imgRegex = /https:\/\/media\.wheelpros\.com\/asset\/[a-f0-9-]+\/Large\/([A-Z0-9-]+)(?:-[IOpio])?(?:-png)?\.png/gi;
      let match;
      let pageCount = 0;
      
      while ((match = imgRegex.exec(html)) !== null) {
        const sku = match[1];
        const url = match[0];
        if (!allImages[sku]) {
          allImages[sku] = url;
          pageCount++;
          totalFound++;
        }
      }
      
      console.log(`Page ${page}: found ${pageCount} new images (total: ${totalFound})`);
      
      // Check if there's a next page
      hasMore = html.includes(`p=${page + 1}`);
      page++;
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
      
    } catch (e) {
      console.error(`Error on page ${page}:`, e.message);
      hasMore = false;
    }
  }
  
  console.log(`${brand.name}: Found ${totalFound} total images`);
}

async function main() {
  // Scrape each brand
  for (const brand of BRANDS) {
    await scrapeBrand(brand);
  }
  
  console.log(`\n=== Total images collected: ${Object.keys(allImages).length} ===`);
  
  // Save to file
  writeFileSync('data/dealerline-all-images.json', JSON.stringify(allImages, null, 2));
  
  // Update database
  console.log('\nUpdating database...');
  let updated = 0;
  
  for (const [sku, url] of Object.entries(allImages)) {
    const result = await pool.query(
      `UPDATE accessories SET image_url = $1 WHERE sku = $2 AND image_url IS NULL RETURNING sku`,
      [url, sku]
    );
    if (result.rowCount > 0) {
      updated++;
    }
  }
  
  console.log(`Updated ${updated} products with new images!`);
  
  await pool.end();
}

main().catch(console.error);
