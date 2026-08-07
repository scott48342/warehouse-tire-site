/**
 * Fix F-Body (Firebird/Camaro) hub bore from 70.7mm to 70.3mm
 * 
 * The 2nd gen F-body (1970-1981) shares the 5x120.65 bolt pattern with G-body
 * and has the same 70.3mm hub bore.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const client = await pool.connect();
  
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== FIXING F-BODY HUB BORE ===');
  
  try {
    // Check what needs fixing
    const { rows: before } = await client.query(`
      SELECT id, year, make, model, center_bore_mm 
      FROM vehicle_fitments 
      WHERE bolt_pattern = '5x120.65' 
        AND center_bore_mm = 70.7
    `);
    
    console.log(`\nRecords with 70.7mm hub bore: ${before.length}`);
    before.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.center_bore_mm}mm`));
    
    if (!DRY_RUN && before.length > 0) {
      const { rowCount } = await client.query(`
        UPDATE vehicle_fitments 
        SET center_bore_mm = 70.3,
            last_modified_by = 'fix-fbody-hubbore',
            last_modified_reason = 'Corrected F-Body hub bore from 70.7mm to 70.3mm',
            updated_at = NOW()
        WHERE bolt_pattern = '5x120.65' 
          AND center_bore_mm = 70.7
      `);
      console.log(`\nUpdated ${rowCount} records to 70.3mm`);
    }
    
    console.log('\n=== DONE ===');
    if (DRY_RUN) {
      console.log('⚠️  DRY RUN - no changes made. Run without --dry-run to apply.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
