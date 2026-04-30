/**
 * Scrape UTQG for ALL brands from tiresize.com
 * Run: node scripts/scrape-all-brands.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// All brands on tiresize.com that we might have in TireWeb
const TIRESIZE_BRANDS = [
  'Mastercraft', 'Uniroyal', 'Kelly', 'Starfire', 'Fuzion',
  'Laufenn', 'GT-Radial', 'Nokian', 'Vogue', 'Gladiator',
  'Crosswind', 'Westlake', 'Double-Coin', 'Hercules', 'Thunderer',
  'Milestar', 'Lexani', 'Lionhart', 'Kenda', 'Sailun',
  'Sumitomo', 'Federal', 'Atturo', 'Nankang', 'Radar',
  'Arroyo', 'Achilles', 'Accelera', 'Delinte', 'Landsail',
];

async function fetchBrandPatterns(brandUrl) {
  const url = `https://tiresize.com/tires/${brandUrl}/`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const patternRegex = new RegExp(`/tires/${brandUrl}/([^"]+)\\.htm`, 'gi');
    const matches = [...html.matchAll(patternRegex)];
    
    // Filter out size-specific pages
    const patterns = [...new Set(matches.map(m => m[1]))]
      .filter(p => !/\d{3}-\d{2}R\d{2}/.test(p));
    
    return patterns;
  } catch (err) {
    return [];
  }
}

async function fetchPatternUtqg(brandUrl, patternSlug) {
  const url = `https://tiresize.com/tires/${brandUrl}/${patternSlug}.htm`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
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
      updated_at = NOW()
  `, [brand, patternName, patternKey, specs.utqg, specs.treadwear, specs.traction, specs.temperature]);
}

async function main() {
  console.log('=== Scraping ALL brands from tiresize.com ===\n');
  
  let totalFound = 0;
  let totalNotFound = 0;
  const results = {};
  
  for (const brandUrl of TIRESIZE_BRANDS) {
    const brand = brandUrl.replace(/-/g, ' ').toUpperCase();
    process.stdout.write(`${brand}... `);
    
    const patterns = await fetchBrandPatterns(brandUrl);
    if (patterns.length === 0) {
      console.log('no patterns found');
      continue;
    }
    
    let found = 0;
    for (const patternSlug of patterns) {
      const patternName = patternSlug.replace(/-/g, ' ');
      const specs = await fetchPatternUtqg(brandUrl, patternSlug);
      
      if (specs) {
        await upsertPatternSpec(brand, patternName, specs);
        found++;
        totalFound++;
      } else {
        totalNotFound++;
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`${found}/${patterns.length} patterns with UTQG`);
    if (found > 0) results[brand] = found;
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total patterns with UTQG: ${totalFound}`);
  console.log(`Patterns without UTQG: ${totalNotFound}`);
  console.log('\nBrands scraped:');
  Object.entries(results).sort((a, b) => b[1] - a[1]).forEach(([brand, count]) => {
    console.log(`  ${brand}: ${count}`);
  });
  
  // Final count
  const { rows } = await pool.query(`
    SELECT COUNT(*) as total, COUNT(utqg) as with_utqg
    FROM tire_pattern_specs
  `);
  console.log(`\nTotal in DB: ${rows[0].total} patterns, ${rows[0].with_utqg} with UTQG`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
