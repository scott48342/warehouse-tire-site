import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// TireWeb brands we have
const twBrands = await pool.query(`
  SELECT DISTINCT brand, COUNT(*) as skus
  FROM tireweb_sku_cache
  WHERE last_seen_at > NOW() - INTERVAL '7 days'
  GROUP BY brand
  ORDER BY skus DESC
`);

// Specs by brand
const specsBrands = await pool.query(`
  SELECT UPPER(brand) as brand, COUNT(*) as patterns, COUNT(utqg) as with_utqg
  FROM tire_pattern_specs
  GROUP BY UPPER(brand)
`);

const specsMap = new Map(specsBrands.rows.map(r => [r.brand, r]));

console.log('=== TIREWEB BRANDS - UTQG COVERAGE ===\n');
console.log('Brand                  | SKUs  | Patterns | w/UTQG | Status');
console.log('-'.repeat(70));

let needsSpecs = [];

for (const row of twBrands.rows) {
  const brand = row.brand;
  const skus = parseInt(row.skus);
  const specs = specsMap.get(brand) || { patterns: 0, with_utqg: 0 };
  const patterns = parseInt(specs.patterns) || 0;
  const withUtqg = parseInt(specs.with_utqg) || 0;
  
  let status = '✅';
  if (patterns === 0) {
    status = '❌ NO SPECS';
    needsSpecs.push({ brand, skus });
  } else if (withUtqg === 0) {
    status = '⚠️ No UTQG';
  } else if (withUtqg < patterns * 0.5) {
    status = '⚠️ Partial';
  }
  
  console.log(`${brand.padEnd(22)} | ${String(skus).padStart(5)} | ${String(patterns).padStart(8)} | ${String(withUtqg).padStart(6)} | ${status}`);
}

console.log('\n=== BRANDS NEEDING SPECS (by SKU count) ===');
needsSpecs.sort((a, b) => b.skus - a.skus).forEach(({ brand, skus }) => {
  console.log(`  ${brand}: ${skus} SKUs`);
});

await pool.end();
