#!/usr/bin/env node
/**
 * Merge images from WheelPros Techfeed into dealerline-images.json
 */

import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const DEALERLINE_FILE = join(DATA_DIR, 'dealerline-images.json');
const ACCESSORY_CSV = join(DATA_DIR, 'Accessory_TechGuide.csv');
const LUGNUT_CSV = join(DATA_DIR, 'LugNut_TechGuide.csv');
const LIGHTING_CSV = join(DATA_DIR, 'Lighting_TechGuide.csv');

// Load existing dealerline data
function loadExisting() {
  if (existsSync(DEALERLINE_FILE)) {
    return JSON.parse(readFileSync(DEALERLINE_FILE, 'utf8'));
  }
  return [];
}

// Parse CSV and extract image URLs
function parseCSV(filePath, category) {
  if (!existsSync(filePath)) {
    console.log(`⚠️ ${filePath} not found`);
    return [];
  }
  
  const content = readFileSync(filePath, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  
  const results = [];
  for (const row of records) {
    // Handle different column naming conventions
    const sku = (row.sku || row.SKU)?.trim();
    const imageUrl = (row.image_url || row.ImageLink1)?.trim();
    
    if (sku && imageUrl && imageUrl.startsWith('http')) {
      results.push({ sku, img: imageUrl, source: 'techfeed', category });
    }
  }
  
  return results;
}

async function main() {
  console.log('Loading existing dealerline images...');
  const existing = loadExisting();
  console.log(`  Found ${existing.length} existing records`);
  
  // Parse techfeed CSVs
  console.log('\nParsing Accessory_TechGuide.csv...');
  const accessories = parseCSV(ACCESSORY_CSV, 'accessory');
  console.log(`  Found ${accessories.length} accessories with images`);
  
  console.log('\nParsing LugNut_TechGuide.csv...');
  const lugnuts = parseCSV(LUGNUT_CSV, 'lugnut');
  console.log(`  Found ${lugnuts.length} lugnuts with images`);
  
  console.log('\nParsing Lighting_TechGuide.csv...');
  const lighting = parseCSV(LIGHTING_CSV, 'lighting');
  console.log(`  Found ${lighting.length} lighting products with images`);
  
  // Merge and dedupe by SKU
  const allImages = [...existing];
  const existingSkus = new Set(existing.map(e => e.sku.toUpperCase()));
  
  let newAccessories = 0, newLugnuts = 0, newLighting = 0;
  
  for (const item of accessories) {
    if (!existingSkus.has(item.sku.toUpperCase())) {
      allImages.push(item);
      existingSkus.add(item.sku.toUpperCase());
      newAccessories++;
    }
  }
  
  for (const item of lugnuts) {
    if (!existingSkus.has(item.sku.toUpperCase())) {
      allImages.push(item);
      existingSkus.add(item.sku.toUpperCase());
      newLugnuts++;
    }
  }
  
  for (const item of lighting) {
    if (!existingSkus.has(item.sku.toUpperCase())) {
      allImages.push(item);
      existingSkus.add(item.sku.toUpperCase());
      newLighting++;
    }
  }
  
  console.log(`\nAdded ${newAccessories} new accessories`);
  console.log(`Added ${newLugnuts} new lugnuts`);
  console.log(`Added ${newLighting} new lighting`);
  console.log(`Total: ${allImages.length} images`);
  
  // Save
  writeFileSync(DEALERLINE_FILE, JSON.stringify(allImages, null, 2));
  console.log(`\n✅ Saved to ${DEALERLINE_FILE}`);
  
  // Print category stats
  const stats = {
    accessory: allImages.filter(i => i.category === 'accessory' || (!i.category && !i.source)).length,
    lugnut: allImages.filter(i => i.category === 'lugnut').length,
    lighting: allImages.filter(i => i.category === 'lighting').length,
    unknown: allImages.filter(i => !i.category && i.source === 'techfeed').length
  };
  
  console.log('\nCategory stats:');
  console.log(`  Accessories: ${stats.accessory}`);
  console.log(`  Lugnuts: ${stats.lugnut}`);
  console.log(`  Lighting: ${stats.lighting}`);
  console.log(`  Other/Unknown: ${stats.unknown}`);
}

main().catch(console.error);
