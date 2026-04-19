/**
 * Scrape DealerLine for accessory images
 * Run with: node scripts/scrape-dealerline-images.mjs <brand>
 * 
 * This script fetches product search results from DealerLine and extracts image URLs.
 */

import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

const brand = process.argv[2] || 'Gorilla';
console.log(`Scraping images for brand: ${brand}`);

// We'll store the mappings we scrape
const imageMap = {};

// For each brand, we need to manually scrape from DealerLine
// This script reads from a JSON file that we create by scraping the browser

// Check if we have a scraped file
try {
  const scraped = JSON.parse(readFileSync(`data/dealerline-images-${brand.toLowerCase().replace(/ /g, '-')}.json`, 'utf-8'));
  console.log(`Loaded ${Object.keys(scraped).length} scraped images`);
  
  // Update database
  let updated = 0;
  for (const [sku, url] of Object.entries(scraped)) {
    const result = await pool.query(
      `UPDATE accessories SET image_url = $1 WHERE sku = $2 AND image_url IS NULL RETURNING sku`,
      [url, sku]
    );
    if (result.rowCount > 0) {
      updated++;
    }
  }
  console.log(`Updated ${updated} products with images`);
  
} catch (e) {
  console.log('No scraped file found. Creating template...');
  
  // Get all SKUs without images for this brand
  const result = await pool.query(`
    SELECT sku FROM accessories 
    WHERE brand ILIKE $1 AND image_url IS NULL
    ORDER BY sku
  `, [`%${brand}%`]);
  
  console.log(`Found ${result.rows.length} products without images`);
  console.log('\nTo scrape images:');
  console.log('1. Go to DealerLine and search for the brand');
  console.log('2. Use browser console to extract images:');
  console.log(`
  const map = {};
  document.querySelectorAll('img[src*="media.wheelpros.com"]').forEach(img => {
    const match = img.alt.match(/^([A-Z0-9-]+)/);
    if (match) map[match[1]] = img.src;
  });
  console.log(JSON.stringify(map, null, 2));
  `);
  console.log('\n3. Save the output to data/dealerline-images-' + brand.toLowerCase().replace(/ /g, '-') + '.json');
  
  // Write SKUs to a file for reference
  writeFileSync(`data/${brand.toLowerCase().replace(/ /g, '-')}-skus.json`, JSON.stringify(result.rows.map(r => r.sku), null, 2));
}

await pool.end();
