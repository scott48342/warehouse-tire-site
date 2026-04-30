/**
 * Scrape UTQG data from tiresize.com for tire brands missing specs
 * 
 * Usage: node scripts/scrape-utqg-tiresize.mjs [--brand IRONMAN]
 * 
 * This script:
 * 1. Gets tire patterns from tireweb_sku_cache missing UTQG
 * 2. Scrapes tiresize.com for matching patterns
 * 3. Inserts/updates tire_pattern_specs with UTQG data
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Brand name mapping for tiresize.com URLs
const BRAND_URL_MAP = {
  'IRONMAN': 'Ironman',
  'RBP': 'RBP',
  'ARGUS ADVANTA': null, // Not on tiresize.com
  'LEXANI': 'Lexani',
  'LIONHART': 'Lionhart',
  'THUNDERER': 'Thunderer',
  'CROSSWIND': 'Crosswind',
  'WESTLAKE': 'Westlake',
  'GLADIATOR': 'Gladiator',
  'HERCULES': 'Hercules',
  'MASTERCRAFT': 'Mastercraft',
  'STARFIRE': 'Starfire',
  'KELLY': 'Kelly',
  'FUZION': 'Fuzion',
  'UNIROYAL': 'Uniroyal',
  'LAUFENN': 'Laufenn',
  'GT RADIAL': 'GT-Radial',
  'DOUBLE COIN': 'Double-Coin',
  'VOGUE': 'Vogue',
};

// Parse UTQG string from tiresize.com format
// Format: "460 A B" or "700 AA A"
function parseUtqg(utqgStr) {
  if (!utqgStr) return null;
  
  const match = utqgStr.match(/^(\d{3,4})\s+([A-C]{1,2})\s+([A-C])$/i);
  if (match) {
    return {
      utqg: utqgStr.replace(/\s+/g, ''),  // "460AB"
      treadwear: parseInt(match[1], 10),
      traction: match[2].toUpperCase(),
      temperature: match[3].toUpperCase(),
    };
  }
  return null;
}

// Fetch and parse a tire pattern page from tiresize.com
async function fetchTireSpecs(brand, pattern) {
  const brandUrl = BRAND_URL_MAP[brand.toUpperCase()];
  if (!brandUrl) {
    console.log(`  [skip] Brand ${brand} not mapped to tiresize.com`);
    return null;
  }
  
  // Convert pattern name to URL format
  // "All Country HT" -> "All-Country-HT"
  // "iMOVE GEN2 AS" -> "iMOVE-GEN2-AS"
  const patternUrl = pattern
    .replace(/\s+/g, '-')
    .replace(/[\/\\]/g, '-');
  
  const url = `https://tiresize.com/tires/${brandUrl}/${patternUrl}.htm`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.log(`  [404] ${url}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract UTQG from HTML
    // Look for patterns like "460 A B" in the specs table
    const utqgMatch = html.match(/(\d{3,4})\s+([A-C]{1,2})\s+([A-C])\s*\n/i);
    if (utqgMatch) {
      const utqg = `${utqgMatch[1]} ${utqgMatch[2]} ${utqgMatch[3]}`;
      console.log(`  [found] ${brand} ${pattern}: ${utqg}`);
      return parseUtqg(utqg);
    }
    
    // Alternative: look in Size column text
    const altMatch = html.match(/\n(\d{3,4})\s+([A-C]{1,2})\s+([A-C])\n/i);
    if (altMatch) {
      const utqg = `${altMatch[1]} ${altMatch[2]} ${altMatch[3]}`;
      console.log(`  [found] ${brand} ${pattern}: ${utqg}`);
      return parseUtqg(utqg);
    }
    
    console.log(`  [no-utqg] ${url}`);
    return null;
  } catch (err) {
    console.log(`  [error] ${url}: ${err.message}`);
    return null;
  }
}

// Get unique patterns from tireweb_sku_cache that need UTQG
async function getPatternsNeedingUtqg(brandFilter) {
  let query = `
    SELECT DISTINCT brand, model
    FROM tireweb_sku_cache
    WHERE model IS NOT NULL AND model != ''
      AND utqg IS NULL
  `;
  const params = [];
  
  if (brandFilter) {
    query += ` AND UPPER(brand) = $1`;
    params.push(brandFilter.toUpperCase());
  }
  
  query += ` ORDER BY brand, model`;
  
  const { rows } = await pool.query(query, params);
  return rows;
}

// Check if pattern already has UTQG in tire_pattern_specs
async function hasPatternSpec(brand, pattern) {
  const { rows } = await pool.query(`
    SELECT 1 FROM tire_pattern_specs
    WHERE UPPER(brand) = UPPER($1) AND UPPER(pattern_name) = UPPER($2)
    AND utqg IS NOT NULL
    LIMIT 1
  `, [brand, pattern]);
  return rows.length > 0;
}

// Upsert UTQG into tire_pattern_specs
async function upsertPatternSpec(brand, pattern, specs) {
  // Generate pattern_key for matching
  const patternKey = `${brand.toUpperCase()}_${pattern.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  
  await pool.query(`
    INSERT INTO tire_pattern_specs (brand, pattern_name, pattern_key, utqg, treadwear, traction, temperature, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'tiresize.com')
    ON CONFLICT (pattern_key) DO UPDATE SET
      utqg = COALESCE(EXCLUDED.utqg, tire_pattern_specs.utqg),
      treadwear = COALESCE(EXCLUDED.treadwear, tire_pattern_specs.treadwear),
      traction = COALESCE(EXCLUDED.traction, tire_pattern_specs.traction),
      temperature = COALESCE(EXCLUDED.temperature, tire_pattern_specs.temperature),
      updated_at = NOW()
  `, [brand, pattern, patternKey, specs.utqg, specs.treadwear, specs.traction, specs.temperature]);
}

// Also update tireweb_sku_cache with the UTQG
async function updateCacheUtqg(brand, model, specs) {
  await pool.query(`
    UPDATE tireweb_sku_cache
    SET utqg = $1, treadwear = $2, traction = $3, temperature = $4
    WHERE UPPER(brand) = UPPER($5) AND UPPER(model) = UPPER($6)
  `, [specs.utqg, specs.treadwear, specs.traction, specs.temperature, brand, model]);
}

async function main() {
  const args = process.argv.slice(2);
  let brandFilter = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brand' && args[i + 1]) {
      brandFilter = args[i + 1];
    }
  }
  
  console.log('=== UTQG Scraper (tiresize.com) ===');
  if (brandFilter) {
    console.log(`Filtering to brand: ${brandFilter}`);
  }
  
  const patterns = await getPatternsNeedingUtqg(brandFilter);
  console.log(`Found ${patterns.length} patterns needing UTQG\n`);
  
  let found = 0;
  let skipped = 0;
  let notFound = 0;
  
  for (const { brand, model } of patterns) {
    // Check if we already have specs
    if (await hasPatternSpec(brand, model)) {
      skipped++;
      continue;
    }
    
    console.log(`[${brand}] ${model}`);
    
    const specs = await fetchTireSpecs(brand, model);
    if (specs) {
      await upsertPatternSpec(brand, model, specs);
      await updateCacheUtqg(brand, model, specs);
      found++;
    } else {
      notFound++;
    }
    
    // Rate limit: 1 request per second
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n=== Results ===');
  console.log(`Found UTQG: ${found}`);
  console.log(`Already had specs: ${skipped}`);
  console.log(`Not found: ${notFound}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
