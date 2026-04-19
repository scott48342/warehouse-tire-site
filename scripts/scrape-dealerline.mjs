#!/usr/bin/env node
/**
 * DealerLine Image Scraper
 * Scrapes SKU + image URL pairs from WheelPros DealerLine portal
 * 
 * Usage: node scrape-dealerline.mjs <category> <startPage> <endPage>
 * Example: node scrape-dealerline.mjs accessories 2 6
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '..', 'data', 'dealerline-images.json');

// Load existing data
function loadExistingData() {
  if (existsSync(DATA_FILE)) {
    const content = readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(content);
  }
  return [];
}

// Save data
function saveData(data) {
  // Deduplicate by SKU
  const seen = new Set();
  const unique = data.filter(item => {
    if (seen.has(item.sku)) return false;
    seen.add(item.sku);
    return true;
  });
  writeFileSync(DATA_FILE, JSON.stringify(unique, null, 2));
  return unique.length;
}

// Parse command line args
const args = process.argv.slice(2);
const category = args[0] || 'accessories';
const startPage = parseInt(args[1]) || 1;
const endPage = parseInt(args[2]) || 5;

console.log(`Scraping ${category} pages ${startPage}-${endPage}`);
console.log(`Data file: ${DATA_FILE}`);

// Load existing
const existingData = loadExistingData();
console.log(`Existing records: ${existingData.length}`);

// This script outputs instructions for manual scraping
// The actual scraping needs to be done via browser tool
console.log(`
=== MANUAL SCRAPING INSTRUCTIONS ===

For each page, navigate to:
https://dl.wheelpros.com/us_en/ymm/search/?api-type=${category}&pageSize=100&inventorylocations=AL&clearYmm=true&p=<PAGE>

Then run this JavaScript in the console:
-----------------------------------------
const products = [];
document.querySelectorAll('li').forEach(li => {
  const html = li.innerHTML;
  const skuMatch = html.match(/SKU:\\s*([A-Z0-9\\-]+)/i);
  if (!skuMatch) return;
  const sku = skuMatch[1];
  let img = null;
  li.querySelectorAll('img').forEach(i => {
    if (i.src.includes('media.wheelpros.com/asset/') || 
        (i.src.includes('dl.wheelpros.com/media/catalog/product') && 
         !i.src.includes('new_product') && 
         !i.src.includes('gif'))) {
      img = i.src;
    }
  });
  if (img) products.push({ sku, img });
});
console.log(JSON.stringify(products));
-----------------------------------------

Pages to scrape:
${Array.from({length: endPage - startPage + 1}, (_, i) => startPage + i).map(p => 
  `- https://dl.wheelpros.com/us_en/ymm/search/?api-type=${category}&pageSize=100&inventorylocations=AL&clearYmm=true&p=${p}`
).join('\n')}
`);
