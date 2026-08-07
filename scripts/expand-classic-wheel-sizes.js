/**
 * Expand wheel_diameters for 1980s classic cars
 * 
 * Classic cars (1980-1989) typically came with 14" or 15" wheels OEM,
 * but the aftermarket supports up to 22" or even 24" for many of these platforms.
 * 
 * This script expands wheel_diameters to include common upgrade sizes.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

// Classic platforms and their supported upgrade sizes
// Format: { boltPattern: [supportedDiameters] }
const CLASSIC_UPGRADES = {
  // GM A-body, G-body, F-body (5x120.65 / 5x4.75)
  '5x120.65': [14, 15, 16, 17, 18, 20, 22],
  '5-120.65': [14, 15, 16, 17, 18, 20, 22],
  '5x4.75': [14, 15, 16, 17, 18, 20, 22],
  
  // Ford 5x114.3 / 5x4.5
  '5x114.3': [14, 15, 16, 17, 18, 20, 22],
  '5-114.3': [14, 15, 16, 17, 18, 20, 22],
  '5x4.5': [14, 15, 16, 17, 18, 20, 22],
  
  // Mopar / Chrysler 5x114.3
  // Same as Ford
  
  // Ford truck 5x139.7 / 5x5.5
  '5x139.7': [15, 16, 17, 18, 20, 22],
  '5-139.7': [15, 16, 17, 18, 20, 22],
  '5x5.5': [15, 16, 17, 18, 20, 22],
  
  // GM truck 6x139.7 / 6x5.5
  '6x139.7': [15, 16, 17, 18, 20, 22],
  '6-139.7': [15, 16, 17, 18, 20, 22],
  '6x5.5': [15, 16, 17, 18, 20, 22],
  
  // Default for other patterns
  'default': [14, 15, 16, 17, 18, 20],
};

function getUpgradeSizes(boltPattern) {
  const bp = (boltPattern || '').toLowerCase().trim();
  return CLASSIC_UPGRADES[bp] || 
         CLASSIC_UPGRADES[bp.replace('-', 'x')] ||
         CLASSIC_UPGRADES['default'];
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== EXPANDING CLASSIC WHEEL SIZES ===');
  console.log('Expanding wheel_diameters for 1980-1989 vehicles\n');

  const client = await pool.connect();
  
  try {
    // Get all 1980s records
    const { rows: classics } = await client.query(`
      SELECT id, year, make, model, bolt_pattern, wheel_diameters
      FROM vehicle_fitments
      WHERE year >= 1980 AND year <= 1989
      ORDER BY make, model, year
    `);

    console.log(`Found ${classics.length} records from 1980-1989\n`);

    let updated = 0;
    let skipped = 0;
    const updates = [];

    for (const record of classics) {
      const newDiameters = getUpgradeSizes(record.bolt_pattern);
      const currentDiameters = record.wheel_diameters || [];
      
      // Only update if we're adding new sizes
      const missingDiameters = newDiameters.filter(d => !currentDiameters.includes(d));
      
      if (missingDiameters.length === 0) {
        skipped++;
        continue;
      }

      // Merge and sort
      const mergedDiameters = [...new Set([...currentDiameters, ...newDiameters])].sort((a, b) => a - b);

      updates.push({
        id: record.id,
        year: record.year,
        make: record.make,
        model: record.model,
        bp: record.bolt_pattern,
        old: currentDiameters,
        new: mergedDiameters,
        added: missingDiameters,
      });

      if (!DRY_RUN) {
        await client.query(`
          UPDATE vehicle_fitments 
          SET wheel_diameters = $1
          WHERE id = $2
        `, [mergedDiameters, record.id]);
      }
      
      updated++;
    }

    // Summary by bolt pattern
    const byBoltPattern = {};
    for (const u of updates) {
      const bp = u.bp || 'unknown';
      if (!byBoltPattern[bp]) byBoltPattern[bp] = { count: 0, added: new Set() };
      byBoltPattern[bp].count++;
      u.added.forEach(d => byBoltPattern[bp].added.add(d));
    }

    console.log('--- Summary by Bolt Pattern ---');
    for (const [bp, data] of Object.entries(byBoltPattern)) {
      console.log(`${bp}: ${data.count} records, added sizes: [${[...data.added].sort((a,b) => a-b).join(', ')}]`);
    }

    // Sample updates
    console.log('\n--- Sample Updates (first 15) ---');
    for (const u of updates.slice(0, 15)) {
      console.log(`${u.year} ${u.make} ${u.model}: [${u.old.join(',')}] → [${u.new.join(',')}]`);
    }

    console.log(`\n=== RESULTS ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already has sizes): ${skipped}`);
    console.log(`Total: ${classics.length}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - no changes made. Run without --dry-run to apply.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
