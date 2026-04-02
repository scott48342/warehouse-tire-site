#!/usr/bin/env node
/**
 * Search TireWire for a size and show available images (without importing)
 */

require('dotenv').config({ path: '.env.local' });

const size = process.argv[2];
if (!size) {
  console.log('Usage: node search-only.js <size>');
  console.log('Example: node search-only.js 33125020');
  process.exit(1);
}

async function main() {
  const { searchTiresTirewire } = require('../../src/lib/tirewire/client');
  
  console.log(`Searching TireWire for size: ${size}\n`);
  
  const results = await searchTiresTirewire(size);
  const patterns = new Map();
  
  for (const result of results) {
    for (const tire of result.tires) {
      if (tire.patternId && tire.patternId > 0) {
        patterns.set(tire.patternId, {
          patternId: tire.patternId,
          brand: tire.make,
          pattern: tire.pattern,
          imageUrl: `https://tireweb.tirelibrary.com/images/Products/${tire.patternId}.jpg`
        });
      }
    }
  }
  
  const patternList = Array.from(patterns.values());
  console.log(`Found ${patternList.length} unique tire patterns with images:\n`);
  
  // Group by brand
  const byBrand = {};
  for (const p of patternList) {
    if (!byBrand[p.brand]) byBrand[p.brand] = [];
    byBrand[p.brand].push(p);
  }
  
  for (const [brand, tires] of Object.entries(byBrand).sort()) {
    console.log(`${brand}:`);
    for (const t of tires) {
      console.log(`  - ${t.pattern} (ID: ${t.patternId})`);
    }
  }
  
  console.log(`\nTotal: ${patternList.length} patterns with images on TireLibrary`);
}

main().catch(console.error);
