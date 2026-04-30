/**
 * Manually add UTQG specs for patterns not on tiresize.com
 * Data sourced from manufacturer specs or other authoritative sources
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Manual UTQG entries from manufacturer specs
const MANUAL_SPECS = [
  // Ironman (from herculesstires.com / atd-us.com datasheets)
  { brand: 'IRONMAN', pattern: 'ALL COUNTRY HT', utqg: '460AB', treadwear: 460, traction: 'A', temperature: 'B' },
  { brand: 'IRONMAN', pattern: 'RB-SUV', utqg: '460AB', treadwear: 460, traction: 'A', temperature: 'B' },
  { brand: 'IRONMAN', pattern: 'ALL COUNTRY MT', utqg: null, treadwear: null, traction: null, temperature: null }, // M/T tires don't have UTQG
  
  // RBP (from rbptires.com - H/T line specs)
  { brand: 'RBP', pattern: 'GUARANTOR H/T', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'RBP', pattern: 'GUARANTOR HT', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'RBP', pattern: 'REPULSOR MT', utqg: null, treadwear: null, traction: null, temperature: null }, // M/T
  { brand: 'RBP', pattern: 'REPULSOR M/T', utqg: null, treadwear: null, traction: null, temperature: null },
  { brand: 'RBP', pattern: 'REPULSOR RT', utqg: '440AB', treadwear: 440, traction: 'A', temperature: 'B' },
  
  // Argus Advanta (US AutoForce house brand - specs from USAF datasheets)
  { brand: 'ARGUS ADVANTA', pattern: 'SVT-01', utqg: '500AA', treadwear: 500, traction: 'A', temperature: 'A' },
  { brand: 'ARGUS ADVANTA', pattern: 'SUV-01', utqg: '500AA', treadwear: 500, traction: 'A', temperature: 'A' },
  { brand: 'ARGUS ADVANTA', pattern: 'HPX-01', utqg: '420AA', treadwear: 420, traction: 'A', temperature: 'A' },
  { brand: 'ARGUS ADVANTA', pattern: 'TRX PRO', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'ARGUS ADVANTA', pattern: 'TRX A/T', utqg: '480AB', treadwear: 480, traction: 'A', temperature: 'B' },
];

async function upsertSpec(spec) {
  const patternKey = `${spec.brand.toUpperCase()}_${spec.pattern.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  
  // Skip if already exists with data
  const existing = await pool.query(`
    SELECT utqg FROM tire_pattern_specs WHERE pattern_key = $1
  `, [patternKey]);
  
  if (existing.rows.length && existing.rows[0].utqg) {
    console.log(`  [skip] ${spec.brand} ${spec.pattern} - already has UTQG`);
    return;
  }
  
  await pool.query(`
    INSERT INTO tire_pattern_specs (brand, pattern_name, pattern_key, utqg, treadwear, traction, temperature, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
    ON CONFLICT (pattern_key) DO UPDATE SET
      utqg = COALESCE(EXCLUDED.utqg, tire_pattern_specs.utqg),
      treadwear = COALESCE(EXCLUDED.treadwear, tire_pattern_specs.treadwear),
      traction = COALESCE(EXCLUDED.traction, tire_pattern_specs.traction),
      temperature = COALESCE(EXCLUDED.temperature, tire_pattern_specs.temperature),
      source = COALESCE(tire_pattern_specs.source, 'manual'),
      updated_at = NOW()
  `, [spec.brand, spec.pattern, patternKey, spec.utqg, spec.treadwear, spec.traction, spec.temperature]);
  
  console.log(`  [add] ${spec.brand} ${spec.pattern}: ${spec.utqg || 'N/A (M/T)'}`);
}

async function main() {
  console.log('=== Adding Manual UTQG Specs ===\n');
  
  for (const spec of MANUAL_SPECS) {
    await upsertSpec(spec);
  }
  
  // Show summary by brand
  const summary = await pool.query(`
    SELECT brand, COUNT(*) as patterns, COUNT(utqg) as with_utqg
    FROM tire_pattern_specs
    WHERE brand IN ('IRONMAN', 'RBP', 'ARGUS ADVANTA')
    GROUP BY brand
    ORDER BY brand
  `);
  
  console.log('\n=== Summary ===');
  console.table(summary.rows);
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
