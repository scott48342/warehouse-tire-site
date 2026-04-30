/**
 * Scrape ALL tire patterns for a brand from tiresize.com
 * 
 * Usage: node scripts/scrape-brand-utqg.mjs IRONMAN
 * 
 * This crawls the brand page, finds all patterns, and extracts UTQG for each
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
  'NOKIAN': 'Nokian',
};

async function fetchBrandPatterns(brand) {
  const brandUrl = BRAND_URL_MAP[brand.toUpperCase()];
  if (!brandUrl) {
    console.log(`Brand ${brand} not mapped`);
    return [];
  }
  
  const url = `https://tiresize.com/tires/${brandUrl}/`;
  console.log(`Fetching brand page: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  
  if (!response.ok) {
    console.log(`Failed to fetch brand page: ${response.status}`);
    return [];
  }
  
  const html = await response.text();
  
  // Extract pattern URLs from the page
  // Format: /tires/Ironman/All-Country-AT.htm
  const patternRegex = new RegExp(`/tires/${brandUrl}/([^"]+)\\.htm`, 'gi');
  const matches = [...html.matchAll(patternRegex)];
  
  const patterns = [...new Set(matches.map(m => m[1]))];
  console.log(`Found ${patterns.length} patterns: ${patterns.join(', ')}`);
  
  return patterns;
}

async function fetchPatternUtqg(brand, patternSlug) {
  const brandUrl = BRAND_URL_MAP[brand.toUpperCase()];
  const url = `https://tiresize.com/tires/${brandUrl}/${patternSlug}.htm`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Look for UTQG pattern in the specs table
    // Format in HTML: "460 A B" followed by newline
    // Or embedded in size rows like: 109T XL BSW\n460 A B
    
    // Try finding in the raw text
    const utqgMatch = html.match(/\b(\d{3,4})\s+([A-C]{1,2})\s+([A-C])\b/i);
    if (utqgMatch) {
      return {
        utqg: `${utqgMatch[1]}${utqgMatch[2]}${utqgMatch[3]}`,
        treadwear: parseInt(utqgMatch[1], 10),
        traction: utqgMatch[2].toUpperCase(),
        temperature: utqgMatch[3].toUpperCase(),
      };
    }
    
    return null;
  } catch (err) {
    console.log(`  Error fetching ${patternSlug}: ${err.message}`);
    return null;
  }
}

async function upsertPatternSpec(brand, patternName, specs) {
  const patternKey = `${brand.toUpperCase()}_${patternName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  
  await pool.query(`
    INSERT INTO tire_pattern_specs (brand, pattern_name, pattern_key, utqg, treadwear, traction, temperature, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'tiresize.com')
    ON CONFLICT (pattern_key) DO UPDATE SET
      utqg = COALESCE(EXCLUDED.utqg, tire_pattern_specs.utqg),
      treadwear = COALESCE(EXCLUDED.treadwear, tire_pattern_specs.treadwear),
      traction = COALESCE(EXCLUDED.traction, tire_pattern_specs.traction),
      temperature = COALESCE(EXCLUDED.temperature, tire_pattern_specs.temperature),
      source = 'tiresize.com',
      updated_at = NOW()
  `, [brand, patternName, patternKey, specs.utqg, specs.treadwear, specs.traction, specs.temperature]);
}

async function main() {
  const brand = process.argv[2];
  if (!brand) {
    console.log('Usage: node scripts/scrape-brand-utqg.mjs BRAND');
    console.log('Available brands:', Object.keys(BRAND_URL_MAP).join(', '));
    process.exit(1);
  }
  
  console.log(`\n=== Scraping UTQG for ${brand} ===\n`);
  
  const patterns = await fetchBrandPatterns(brand);
  
  let found = 0;
  let notFound = 0;
  
  for (const patternSlug of patterns) {
    // Skip size-specific pages (they have the same UTQG as the main pattern)
    if (patternSlug.includes('-') && /\d{3}-\d{2}R\d{2}/.test(patternSlug)) {
      continue;
    }
    
    // Convert slug to display name: "All-Country-AT" -> "All Country AT"
    const patternName = patternSlug.replace(/-/g, ' ');
    
    console.log(`  ${patternName}...`);
    
    const specs = await fetchPatternUtqg(brand, patternSlug);
    if (specs) {
      console.log(`    UTQG: ${specs.utqg} (${specs.treadwear}/${specs.traction}/${specs.temperature})`);
      await upsertPatternSpec(brand, patternName, specs);
      found++;
    } else {
      console.log(`    No UTQG found`);
      notFound++;
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n=== Results ===`);
  console.log(`Patterns with UTQG: ${found}`);
  console.log(`Patterns without UTQG: ${notFound}`);
  
  // Show what we have now
  const { rows } = await pool.query(`
    SELECT pattern_name, utqg, treadwear, traction, temperature
    FROM tire_pattern_specs
    WHERE UPPER(brand) = UPPER($1) AND utqg IS NOT NULL
    ORDER BY pattern_name
  `, [brand]);
  
  if (rows.length) {
    console.log(`\n=== ${brand} Pattern Specs ===`);
    console.table(rows);
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
