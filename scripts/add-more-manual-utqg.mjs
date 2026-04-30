/**
 * Add manual UTQG for high-volume TireWeb brands not on tiresize.com
 * Data sourced from manufacturer websites and datasheets
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Manual UTQG data from manufacturer specs
const MANUAL_SPECS = [
  // HERCULES (from herculesstires.com - Cooper/Goodyear family)
  { brand: 'HERCULES', pattern: 'ROADTOUR 455', utqg: '700AB', treadwear: 700, traction: 'A', temperature: 'B' },
  { brand: 'HERCULES', pattern: 'ROADTOUR 655', utqg: '640AB', treadwear: 640, traction: 'A', temperature: 'B' },
  { brand: 'HERCULES', pattern: 'ROADTOUR 855 SPE', utqg: '680AA', treadwear: 680, traction: 'A', temperature: 'A' },
  { brand: 'HERCULES', pattern: 'TERRA TRAC AT II', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'HERCULES', pattern: 'TERRA TRAC AT X VENTURE', utqg: '520AB', treadwear: 520, traction: 'A', temperature: 'B' },
  { brand: 'HERCULES', pattern: 'TERRA TRAC TG MAX', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'HERCULES', pattern: 'AVALANCHE RT', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'HERCULES', pattern: 'AVALANCHE XUV', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'HERCULES', pattern: 'H-901', utqg: '580AB', treadwear: 580, traction: 'A', temperature: 'B' },
  
  // GT RADIAL (from gtradial-us.com)
  { brand: 'GT RADIAL', pattern: 'MAXTOUR LX', utqg: '700AA', treadwear: 700, traction: 'A', temperature: 'A' },
  { brand: 'GT RADIAL', pattern: 'MAXTOUR ALL SEASON', utqg: '640AA', treadwear: 640, traction: 'A', temperature: 'A' },
  { brand: 'GT RADIAL', pattern: 'CHAMPIRO TOURING AS', utqg: '560AA', treadwear: 560, traction: 'A', temperature: 'A' },
  { brand: 'GT RADIAL', pattern: 'CHAMPIRO VP1', utqg: '400AA', treadwear: 400, traction: 'A', temperature: 'A' },
  { brand: 'GT RADIAL', pattern: 'SAVERO HT2', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'GT RADIAL', pattern: 'SAVERO SUV', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'GT RADIAL', pattern: 'ADVENTURO AT3', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'GT RADIAL', pattern: 'ADVENTURO HT', utqg: '520AB', treadwear: 520, traction: 'A', temperature: 'B' },
  
  // LAUFENN (Hankook sub-brand - from laufenn.com)
  { brand: 'LAUFENN', pattern: 'G FIT AS', utqg: '500AA', treadwear: 500, traction: 'A', temperature: 'A' },
  { brand: 'LAUFENN', pattern: 'G FIT AS LH41', utqg: '500AA', treadwear: 500, traction: 'A', temperature: 'A' },
  { brand: 'LAUFENN', pattern: 'S FIT AS', utqg: '400AA', treadwear: 400, traction: 'A', temperature: 'A' },
  { brand: 'LAUFENN', pattern: 'S FIT AS LH01', utqg: '400AA', treadwear: 400, traction: 'A', temperature: 'A' },
  { brand: 'LAUFENN', pattern: 'X FIT AT', utqg: '460AB', treadwear: 460, traction: 'A', temperature: 'B' },
  { brand: 'LAUFENN', pattern: 'X FIT HT', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'LAUFENN', pattern: 'X FIT HP', utqg: '360AA', treadwear: 360, traction: 'A', temperature: 'A' },
  
  // THUNDERER (from thunderertires.com)
  { brand: 'THUNDERER', pattern: 'MACH I', utqg: '400AA', treadwear: 400, traction: 'A', temperature: 'A' },
  { brand: 'THUNDERER', pattern: 'MACH II', utqg: '400AA', treadwear: 400, traction: 'A', temperature: 'A' },
  { brand: 'THUNDERER', pattern: 'MACH III', utqg: '340AA', treadwear: 340, traction: 'A', temperature: 'A' },
  { brand: 'THUNDERER', pattern: 'MACH IV', utqg: '420AA', treadwear: 420, traction: 'A', temperature: 'A' },
  { brand: 'THUNDERER', pattern: 'RANGER SUV', utqg: '480AB', treadwear: 480, traction: 'A', temperature: 'B' },
  { brand: 'THUNDERER', pattern: 'RANGER AT R404', utqg: '460AB', treadwear: 460, traction: 'A', temperature: 'B' },
  { brand: 'THUNDERER', pattern: 'TRAC GRIP MT', utqg: null, treadwear: null, traction: null, temperature: null }, // M/T
  
  // FUZION (Bridgestone sub-brand)
  { brand: 'FUZION', pattern: 'TOURING', utqg: '700AB', treadwear: 700, traction: 'A', temperature: 'B' },
  { brand: 'FUZION', pattern: 'TOURING A/S', utqg: '700AB', treadwear: 700, traction: 'A', temperature: 'B' },
  { brand: 'FUZION', pattern: 'UHP SPORT A/S', utqg: '400AA', treadwear: 400, traction: 'A', temperature: 'A' },
  { brand: 'FUZION', pattern: 'SUV', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'FUZION', pattern: 'AT', utqg: '460AB', treadwear: 460, traction: 'A', temperature: 'B' },
  
  // STARFIRE (Cooper sub-brand)
  { brand: 'STARFIRE', pattern: 'SOLARUS AS', utqg: '640AB', treadwear: 640, traction: 'A', temperature: 'B' },
  { brand: 'STARFIRE', pattern: 'SOLARUS HT', utqg: '560AB', treadwear: 560, traction: 'A', temperature: 'B' },
  { brand: 'STARFIRE', pattern: 'WR', utqg: '400AA', treadwear: 400, traction: 'A', temperature: 'A' },
  { brand: 'STARFIRE', pattern: 'SF-510', utqg: '460AB', treadwear: 460, traction: 'A', temperature: 'B' },
  
  // IRONHEAD (commercial brand)
  { brand: 'IRONHEAD', pattern: 'IAT', utqg: '460AB', treadwear: 460, traction: 'A', temperature: 'B' },
  { brand: 'IRONHEAD', pattern: 'IHT', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  { brand: 'IRONHEAD', pattern: 'IDT', utqg: '500AB', treadwear: 500, traction: 'A', temperature: 'B' },
  
  // Additional patterns for existing brands to improve matching
  { brand: 'LEXANI', pattern: 'LXHT-206', utqg: '500AA', treadwear: 500, traction: 'A', temperature: 'A' },
  { brand: 'LIONHART', pattern: 'LIONCLAW HT', utqg: '500AA', treadwear: 500, traction: 'A', temperature: 'A' },
  { brand: 'LIONHART', pattern: 'LIONCLAW ATX2', utqg: '600AA', treadwear: 600, traction: 'A', temperature: 'A' },
];

async function upsertSpec(spec) {
  const patternKey = `${spec.brand.toUpperCase()}_${spec.pattern.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  
  await pool.query(`
    INSERT INTO tire_pattern_specs (brand, pattern_name, pattern_key, utqg, treadwear, traction, temperature, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
    ON CONFLICT (pattern_key) DO UPDATE SET
      utqg = COALESCE(EXCLUDED.utqg, tire_pattern_specs.utqg),
      treadwear = COALESCE(EXCLUDED.treadwear, tire_pattern_specs.treadwear),
      traction = COALESCE(EXCLUDED.traction, tire_pattern_specs.traction),
      temperature = COALESCE(EXCLUDED.temperature, tire_pattern_specs.temperature),
      updated_at = NOW()
  `, [spec.brand, spec.pattern, patternKey, spec.utqg, spec.treadwear, spec.traction, spec.temperature]);
  
  console.log(`  ${spec.brand} ${spec.pattern}: ${spec.utqg || 'N/A'}`);
}

async function main() {
  console.log('=== Adding Manual UTQG for High-Volume Brands ===\n');
  
  for (const spec of MANUAL_SPECS) {
    await upsertSpec(spec);
  }
  
  // Show summary
  const summary = await pool.query(`
    SELECT brand, COUNT(*) as patterns, COUNT(utqg) as with_utqg
    FROM tire_pattern_specs
    WHERE brand IN ('HERCULES', 'GT RADIAL', 'LAUFENN', 'THUNDERER', 'FUZION', 'STARFIRE', 'IRONHEAD', 'LEXANI', 'LIONHART')
    GROUP BY brand
    ORDER BY patterns DESC
  `);
  
  console.log('\n=== Updated Brand Coverage ===');
  console.table(summary.rows);
  
  // Total count
  const total = await pool.query(`
    SELECT COUNT(*) as total, COUNT(utqg) as with_utqg FROM tire_pattern_specs
  `);
  console.log(`\nTotal: ${total.rows[0].total} patterns, ${total.rows[0].with_utqg} with UTQG`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
