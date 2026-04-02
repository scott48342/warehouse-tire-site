/**
 * Add missing 2008 Chrysler 300C trims
 * 
 * 2008 Chrysler 300C trims:
 * - 300C (Base RWD) - existing
 * - 300C AWD
 * - 300C SRT8 (high performance)
 * 
 * All use 5x115 bolt pattern
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const TRIMS_TO_ADD = [
  {
    year: 2008,
    make: 'chrysler',
    model: '300c',
    display_trim: 'AWD',
    raw_trim: 'AWD',
    bolt_pattern: '5x115',
    oem_wheel_sizes: [
      { diameter: 17, width: 7.0 },
      { diameter: 18, width: 7.5 },
    ],
    source: 'manual_research',
  },
  {
    year: 2008,
    make: 'chrysler',
    model: '300c',
    display_trim: 'SRT8',
    raw_trim: 'SRT8',
    bolt_pattern: '5x115',
    oem_wheel_sizes: [
      { diameter: 20, width: 9.0 },  // SRT8 came with 20" wheels
    ],
    source: 'manual_research',
  },
];

function generateModificationId(year, make, model, trim) {
  const base = `${make}-${model}-${trim}-${year}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const hash = crypto.createHash('md5').update(base + Date.now()).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('Adding missing 2008 Chrysler 300C trims...\n');

  for (const trim of TRIMS_TO_ADD) {
    const modificationId = generateModificationId(trim.year, trim.make, trim.model, trim.display_trim);
    
    // Check if already exists
    const exists = await pool.query(`
      SELECT 1 FROM vehicle_fitments 
      WHERE year = $1 AND make = $2 AND model = $3 AND display_trim = $4
    `, [trim.year, trim.make, trim.model, trim.display_trim]);
    
    if (exists.rows.length > 0) {
      console.log(`  ⏭ ${trim.display_trim} already exists, skipping`);
      continue;
    }

    await pool.query(`
      INSERT INTO vehicle_fitments (
        modification_id, year, make, model, display_trim, raw_trim,
        bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    `, [
      modificationId,
      trim.year,
      trim.make,
      trim.model,
      trim.display_trim,
      trim.raw_trim,
      trim.bolt_pattern,
      JSON.stringify(trim.oem_wheel_sizes),
      trim.source,
    ]);
    
    console.log(`  ✅ Added ${trim.display_trim} (${modificationId})`);
  }

  // Verify
  console.log('\n=== 2008 Chrysler 300C trims now ===');
  const result = await pool.query(`
    SELECT display_trim, bolt_pattern, source
    FROM vehicle_fitments
    WHERE year = 2008 AND make = 'chrysler' AND model = '300c'
    ORDER BY display_trim
  `);
  for (const r of result.rows) {
    console.log(`  ${r.display_trim} | ${r.bolt_pattern} | ${r.source}`);
  }

  await pool.end();
  console.log('\nDone!');
}

main().catch(console.error);
