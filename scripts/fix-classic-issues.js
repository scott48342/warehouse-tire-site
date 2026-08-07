require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Model name standardization rules (keep TitleCase, no hyphens for multi-word)
const modelFixes = [
  { make: 'Buick', from: 'lesabre', to: 'LeSabre' },
  { make: 'Chevrolet', from: 'monte-carlo', to: 'Monte Carlo' },
  { make: 'Chevrolet', from: 'S-10', to: 'S10' },
  { make: 'Dodge', from: 'grand-caravan', to: 'Grand Caravan' },
  { make: 'Ford', from: 'f-250', to: 'F-250' },
  { make: 'Ford', from: 'f-350', to: 'F-350' },
  { make: 'Lincoln', from: 'continental', to: 'Continental' },
  { make: 'Lincoln', from: 'town-car', to: 'Town Car' },
  { make: 'Mercury', from: 'cougar', to: 'Cougar' },
  { make: 'Mercury', from: 'grand-marquis', to: 'Grand Marquis' },
  { make: 'Pontiac', from: 'bonneville', to: 'Bonneville' },
  { make: 'Pontiac', from: 'grand-prix', to: 'Grand Prix' },
  { make: 'Toyota', from: '4runner', to: '4Runner' },
];

// Lincoln Continental hub bore: 5x108, 63.4mm hub (1980s Ford/Lincoln spec)
const hubFixes = [
  { year: 1980, make: 'Lincoln', model: 'Continental', center_bore_mm: 63.4 },
  { year: 1981, make: 'Lincoln', model: 'Continental', center_bore_mm: 63.4 },
];

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN MODE ===' : '=== APPLYING FIXES ===');
    console.log('');
    
    // Fix model names
    console.log('--- MODEL NAME FIXES ---\n');
    for (const fix of modelFixes) {
      const result = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments
        WHERE make = $1 AND model = $2 AND year >= 1980 AND year <= 1990
      `, [fix.make, fix.from]);
      
      const count = parseInt(result.rows[0].cnt);
      if (count > 0) {
        console.log(`${fix.make} "${fix.from}" -> "${fix.to}": ${count} records`);
        
        if (!dryRun) {
          await client.query(`
            UPDATE vehicle_fitments
            SET model = $1, updated_at = NOW()
            WHERE make = $2 AND model = $3 AND year >= 1980 AND year <= 1990
          `, [fix.to, fix.make, fix.from]);
          console.log(`  ✅ Updated`);
        }
      }
    }
    
    // Fix missing hub bores
    console.log('\n--- HUB BORE FIXES ---\n');
    for (const fix of hubFixes) {
      const result = await client.query(`
        SELECT id, year, make, model, center_bore_mm FROM vehicle_fitments
        WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3 AND center_bore_mm IS NULL
      `, [fix.year, fix.make, fix.model]);
      
      if (result.rows.length > 0) {
        console.log(`${fix.year} ${fix.make} ${fix.model}: Setting center_bore_mm to ${fix.center_bore_mm}mm`);
        
        if (!dryRun) {
          await client.query(`
            UPDATE vehicle_fitments
            SET center_bore_mm = $1, updated_at = NOW()
            WHERE year = $2 AND make ILIKE $3 AND model ILIKE $4 AND center_bore_mm IS NULL
          `, [fix.center_bore_mm, fix.year, fix.make, fix.model]);
          console.log(`  ✅ Updated ${result.rows.length} record(s)`);
        }
      }
    }
    
    // Also fix model name case for Lincoln Continental in the same query
    const contResult = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments
      WHERE make = 'Lincoln' AND model = 'continental' AND year >= 1980 AND year <= 1990
    `);
    if (parseInt(contResult.rows[0].cnt) > 0) {
      console.log(`\nLincoln "continental" -> "Continental": ${contResult.rows[0].cnt} records`);
      if (!dryRun) {
        await client.query(`
          UPDATE vehicle_fitments
          SET model = 'Continental', updated_at = NOW()
          WHERE make = 'Lincoln' AND model = 'continental' AND year >= 1980 AND year <= 1990
        `);
        console.log(`  ✅ Updated`);
      }
    }
    
    if (dryRun) {
      console.log('\n--- DRY RUN COMPLETE ---');
      console.log('Run without --dry-run to apply changes.');
    } else {
      console.log('\n--- ALL FIXES APPLIED ---');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
