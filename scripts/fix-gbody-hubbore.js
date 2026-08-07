/**
 * Fix G-Body hub bore from 78.1mm to 70.3mm
 * 
 * The 1984 Buick Regal (and all G-Body cars) have a 70.3mm hub bore,
 * not 78.1mm as currently stored in vehicle_fitments and classic_fitments.
 * 
 * This was filtering out wheels with 70.3mm center bore.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const client = await pool.connect();
  
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== FIXING G-BODY HUB BORE ===');
  
  try {
    // Fix vehicle_fitments table
    const { rows: vfBefore } = await client.query(`
      SELECT id, year, make, model, center_bore_mm 
      FROM vehicle_fitments 
      WHERE bolt_pattern = '5x120.65' 
        AND year BETWEEN 1978 AND 1988
        AND center_bore_mm = 78.1
      LIMIT 20
    `);
    
    console.log(`\nvehicle_fitments with 78.1mm hub bore (5x120.65, 1978-1988): ${vfBefore.length} samples`);
    vfBefore.slice(0, 5).forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.center_bore_mm}mm`));
    
    if (!DRY_RUN) {
      const { rowCount: vfUpdated } = await client.query(`
        UPDATE vehicle_fitments 
        SET center_bore_mm = 70.3,
            last_modified_by = 'fix-gbody-hubbore',
            last_modified_reason = 'Corrected G-Body hub bore from 78.1mm to 70.3mm',
            updated_at = NOW()
        WHERE bolt_pattern = '5x120.65' 
          AND year BETWEEN 1978 AND 1988
          AND center_bore_mm = 78.1
      `);
      console.log(`Updated ${vfUpdated} vehicle_fitments records`);
    }
    
    // Fix classic_fitments table
    const { rows: cfBefore } = await client.query(`
      SELECT id, make, model, common_center_bore 
      FROM classic_fitments 
      WHERE platform_code = 'G-BODY'
    `);
    
    console.log(`\nclassic_fitments G-BODY records: ${cfBefore.length}`);
    cfBefore.forEach(r => console.log(`  ${r.make} ${r.model}: ${r.common_center_bore}mm`));
    
    if (!DRY_RUN) {
      const { rowCount: cfUpdated } = await client.query(`
        UPDATE classic_fitments 
        SET common_center_bore = '70.3',
            updated_at = NOW()
        WHERE platform_code = 'G-BODY'
      `);
      console.log(`Updated ${cfUpdated} classic_fitments records`);
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
