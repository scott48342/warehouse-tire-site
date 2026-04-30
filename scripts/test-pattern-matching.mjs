/**
 * Test pattern key matching for UTQG enrichment
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// This is the same normalization as buildPatternKey in patternSpecsCache.ts
function buildPatternKey(brand, patternName) {
  const normBrand = brand.toLowerCase().trim().slice(0, 20);
  const normPattern = patternName
    .toLowerCase()
    .trim()
    .replace(/[-_\s]+/g, '')   // Remove hyphens, underscores, spaces
    .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
    .slice(0, 50);
  
  return `${normBrand}:${normPattern}`;
}

// Test cases - these are the actual model names from TireWeb API
const testCases = [
  { brand: 'IRONMAN', model: 'RB-SUV' },
  { brand: 'IRONMAN', model: 'ALL COUNTRY HT' },
  { brand: 'IRONMAN', model: 'ALL COUNTRY AT' },
  { brand: 'RBP', model: 'GUARANTOR H/T' },
  { brand: 'LEXANI', model: 'LXHT-206' },
  { brand: 'LIONHART', model: 'LIONCLAW HT' },
  { brand: 'HERCULES', model: 'ROADTOUR 655' },
  { brand: 'GT RADIAL', model: 'MAXTOUR LX' },
  { brand: 'LAUFENN', model: 'G FIT AS' },
];

console.log('=== Pattern Key Matching Test ===\n');

// Get all patterns from DB
const { rows: patterns } = await pool.query(`
  SELECT brand, pattern_name, utqg
  FROM tire_pattern_specs
  WHERE brand IN ('IRONMAN', 'RBP', 'LEXANI', 'LIONHART', 'HERCULES', 'GT RADIAL', 'LAUFENN')
`);

// Build a lookup map using the same key generation
const specsMap = new Map();
for (const p of patterns) {
  const key = buildPatternKey(p.brand, p.pattern_name);
  specsMap.set(key, { utqg: p.utqg, brand: p.brand, pattern: p.pattern_name });
}

console.log('DB Patterns with generated keys:');
console.log([...specsMap.entries()].slice(0, 15).map(([k, v]) => `  ${k} → ${v.utqg}`).join('\n'));

console.log('\n\nTest Case Results:');
console.log('-'.repeat(80));

for (const { brand, model } of testCases) {
  const key = buildPatternKey(brand, model);
  const match = specsMap.get(key);
  
  if (match) {
    console.log(`✅ ${brand} "${model}" → key="${key}" → UTQG: ${match.utqg}`);
  } else {
    console.log(`❌ ${brand} "${model}" → key="${key}" → NOT FOUND`);
    
    // Show potential matches
    const potentials = [...specsMap.entries()]
      .filter(([k]) => k.startsWith(brand.toLowerCase().slice(0, 10)))
      .map(([k, v]) => `     possible: ${k} (${v.pattern})`)
      .slice(0, 3);
    if (potentials.length) console.log(potentials.join('\n'));
  }
}

await pool.end();
