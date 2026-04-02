/**
 * Fix remaining Corvette single-trim gaps
 * 
 * 1953-1956: Acceptable (early years, limited options)
 * 1968-1969: Need L88, 427 trims
 * 1981: Need L81 trim
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function genModId(make, model, trim, year) {
  const base = `${make}-${model}-${trim}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const hash = crypto.createHash('md5').update(`${base}-${year}-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 8);
  return `${base}-${hash}`;
}

const FIXES = [
  // 1968 C3 - first year
  { year: 1968, trim: 'L88', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] },
  { year: 1968, trim: '427', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] },
  
  // 1969 C3
  { year: 1969, trim: 'L88', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] },
  { year: 1969, trim: '427', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] },
  { year: 1969, trim: 'ZL1', oem_wheel_sizes: [{ diameter: 15, width: 8.0 }] }, // Ultra rare aluminum 427
  
  // 1981 C3 - last carbureted year
  { year: 1981, trim: 'L81', oem_wheel_sizes: [{ diameter: 15, width: 7.0 }] },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Fixing Corvette single-trim gaps...\n');

  let added = 0;
  
  for (const fix of FIXES) {
    const modId = genModId('chevrolet', 'corvette', fix.trim, fix.year);
    
    // Check if exists
    const exists = await pool.query(`
      SELECT 1 FROM vehicle_fitments 
      WHERE make = 'chevrolet' AND model = 'corvette' AND year = $1 AND display_trim = $2
    `, [fix.year, fix.trim]);
    
    if (exists.rows.length > 0) {
      console.log(`  ⏭ ${fix.year} ${fix.trim} already exists`);
      continue;
    }
    
    await pool.query(`
      INSERT INTO vehicle_fitments (
        modification_id, year, make, model, display_trim, raw_trim,
        bolt_pattern, oem_wheel_sizes, source, created_at, updated_at
      ) VALUES ($1, $2, 'chevrolet', 'corvette', $3, $4, '5x120.65', $5, 'generation_inherit', NOW(), NOW())
    `, [modId, fix.year, fix.trim, fix.trim, JSON.stringify(fix.oem_wheel_sizes)]);
    
    console.log(`  ✅ ${fix.year} ${fix.trim}`);
    added++;
  }

  console.log(`\nAdded: ${added}`);

  // Verify remaining single-trim
  const single = await pool.query(`
    SELECT year FROM vehicle_fitments 
    WHERE make = 'chevrolet' AND model = 'corvette'
    GROUP BY year HAVING COUNT(*) = 1
    ORDER BY year
  `);
  
  console.log(`\nRemaining single-trim years: ${single.rows.length}`);
  if (single.rows.length > 0) {
    console.log(`  ${single.rows.map(r => r.year).join(', ')}`);
    console.log('  (1953-1956 are acceptable - early years with limited options)');
  }

  await pool.end();
}
main();
