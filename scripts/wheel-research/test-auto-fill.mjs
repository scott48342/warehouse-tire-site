/**
 * Test script: Auto-fill wheel specs from web search
 * Runs on 20 vehicles and displays results for review
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Get 20 incomplete vehicles (prioritize popular makes)
const { rows: vehicles } = await client.query(`
  SELECT DISTINCT year, make, model
  FROM vehicle_fitments
  WHERE quality_tier != 'complete'
    AND year >= 2015
    AND make IN ('Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Kia', 'Hyundai', 'Mazda')
  ORDER BY make, model, year DESC
  LIMIT 20
`);

console.log(`Found ${vehicles.length} vehicles to research\n`);

// Regex patterns to extract wheel specs
const patterns = {
  // Matches: 18x7.5, 19" x 8, 17"x7", 20 x 8.5
  sizePattern: /(\d{2})[""]?\s*[xX×]\s*(\d+(?:\.\d+)?)/g,
  // Matches: offset 45mm, ET45, offset of 50mm, 45mm offset
  offsetPattern: /(?:offset\s*(?:of\s*)?|ET)(\d+)\s*mm|(\d+)\s*mm\s*offset/gi,
  // Matches: 5x114.3, 5-114.3, 5 x 114.3mm, 5-4.5"
  boltPattern: /(\d)\s*[-xX×]\s*(\d{2,3}(?:\.\d+)?)\s*(?:mm)?|(\d)\s*[-xX]\s*(\d+(?:\.\d+)?)[""]/g,
  // Matches: center bore 67.1mm, CB: 67.1, hub bore 67.1
  centerBorePattern: /(?:center\s*bore|CB|hub\s*bore)[:\s]*(\d+(?:\.\d+)?)\s*mm/gi,
};

function parseWheelSpecs(searchResults) {
  const specs = {
    sizes: [],      // [{diameter, width, offset}]
    boltPattern: null,
    centerBore: null,
    sources: []
  };
  
  const seenSizes = new Set();
  
  for (const result of searchResults) {
    const text = `${result.title} ${result.description}`;
    specs.sources.push(result.siteName || new URL(result.url).hostname);
    
    // Extract wheel sizes
    let sizeMatch;
    patterns.sizePattern.lastIndex = 0;
    while ((sizeMatch = patterns.sizePattern.exec(text)) !== null) {
      const diameter = parseInt(sizeMatch[1]);
      const width = parseFloat(sizeMatch[2]);
      
      // Sanity check - valid wheel sizes
      if (diameter >= 14 && diameter <= 24 && width >= 5 && width <= 12) {
        // Look for offset near this match
        let offset = null;
        const offsetMatch = text.match(/(?:offset\s*(?:of\s*)?|ET)(\d+)|(\d+)\s*mm\s*offset/i);
        if (offsetMatch) {
          offset = parseInt(offsetMatch[1] || offsetMatch[2]);
          if (offset > 70 || offset < 0) offset = null; // Sanity check
        }
        
        const sizeKey = `${diameter}x${width}`;
        if (!seenSizes.has(sizeKey)) {
          seenSizes.add(sizeKey);
          specs.sizes.push({ diameter, width, offset });
        }
      }
    }
    
    // Extract bolt pattern
    if (!specs.boltPattern) {
      patterns.boltPattern.lastIndex = 0;
      const boltMatch = patterns.boltPattern.exec(text);
      if (boltMatch) {
        const lugs = boltMatch[1] || boltMatch[3];
        let pcd = boltMatch[2] || boltMatch[4];
        
        // Convert inches to mm if needed (4.5" = 114.3mm)
        if (parseFloat(pcd) < 10) {
          pcd = (parseFloat(pcd) * 25.4).toFixed(1);
        }
        
        if (parseInt(lugs) >= 4 && parseInt(lugs) <= 8) {
          specs.boltPattern = `${lugs}x${pcd}`;
        }
      }
    }
    
    // Extract center bore
    if (!specs.centerBore) {
      patterns.centerBorePattern.lastIndex = 0;
      const cbMatch = patterns.centerBorePattern.exec(text);
      if (cbMatch) {
        const cb = parseFloat(cbMatch[1]);
        if (cb >= 50 && cb <= 110) {
          specs.centerBore = cb;
        }
      }
    }
  }
  
  return specs;
}

async function searchVehicle(year, make, model) {
  const query = `${year} ${make} ${model} OEM wheel size specs diameter width offset bolt pattern`;
  
  const response = await fetch('https://api.search.brave.com/res/v1/web/search?' + new URLSearchParams({
    q: query,
    count: '8'
  }), {
    headers: {
      'X-Subscription-Token': process.env.BRAVE_API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.web?.results || [];
}

// Process vehicles
const results = [];

for (let i = 0; i < vehicles.length; i++) {
  const { year, make, model } = vehicles[i];
  console.log(`[${i + 1}/${vehicles.length}] Searching: ${year} ${make} ${model}...`);
  
  try {
    const searchResults = await searchVehicle(year, make, model);
    const specs = parseWheelSpecs(searchResults);
    
    results.push({
      year, make, model,
      ...specs,
      searchResultCount: searchResults.length
    });
    
    // Rate limit - 2 seconds between requests
    if (i < vehicles.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    results.push({
      year, make, model,
      error: err.message
    });
  }
}

// Display results
console.log('\n' + '='.repeat(80));
console.log('RESULTS - REVIEW BEFORE APPLYING');
console.log('='.repeat(80) + '\n');

let successCount = 0;
let partialCount = 0;
let failCount = 0;

for (const r of results) {
  console.log(`\n${r.year} ${r.make} ${r.model}`);
  console.log('-'.repeat(40));
  
  if (r.error) {
    console.log(`  ❌ ERROR: ${r.error}`);
    failCount++;
    continue;
  }
  
  if (r.sizes.length === 0) {
    console.log(`  ⚠️  No wheel sizes found`);
    failCount++;
    continue;
  }
  
  console.log(`  Wheel sizes:`);
  for (const s of r.sizes) {
    const offsetStr = s.offset !== null ? `, ET${s.offset}` : ', offset ?';
    console.log(`    • ${s.diameter}" x ${s.width}"${offsetStr}`);
  }
  
  console.log(`  Bolt pattern: ${r.boltPattern || '?'}`);
  console.log(`  Center bore: ${r.centerBore ? r.centerBore + 'mm' : '?'}`);
  console.log(`  Sources: ${[...new Set(r.sources)].slice(0, 3).join(', ')}`);
  
  if (r.sizes.length > 0 && r.boltPattern) {
    if (r.sizes.some(s => s.offset !== null)) {
      console.log(`  ✅ COMPLETE`);
      successCount++;
    } else {
      console.log(`  🟡 PARTIAL (missing offset)`);
      partialCount++;
    }
  } else {
    console.log(`  🟡 PARTIAL`);
    partialCount++;
  }
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total: ${results.length}`);
console.log(`✅ Complete: ${successCount}`);
console.log(`🟡 Partial: ${partialCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);

// Save raw results for debugging
const fs = await import('fs');
fs.writeFileSync(
  'scripts/wheel-research/test-results.json',
  JSON.stringify(results, null, 2)
);
console.log('\nRaw results saved to scripts/wheel-research/test-results.json');

await client.end();
