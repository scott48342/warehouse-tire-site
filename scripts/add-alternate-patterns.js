require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  
  try {
    // Add column if not exists
    await client.query(`
      ALTER TABLE classic_fitments 
      ADD COLUMN IF NOT EXISTS alternate_bolt_patterns text[]
    `);
    console.log('Added alternate_bolt_patterns column');
    
    // Update G-BODY records with alternate patterns
    const { rowCount } = await client.query(`
      UPDATE classic_fitments 
      SET alternate_bolt_patterns = ARRAY['5x120', '5x114.3']
      WHERE platform_code = 'G-BODY'
    `);
    console.log(`Updated ${rowCount} G-BODY records with alternate patterns [5x120, 5x114.3]`);
    
    // Also expand the ranges
    const { rowCount: rangeCount } = await client.query(`
      UPDATE classic_fitments 
      SET 
        rec_wheel_diameter_max = 24,
        rec_wheel_width_max = 12.0,
        rec_offset_max_mm = 45
      WHERE platform_code = 'G-BODY'
    `);
    console.log(`Expanded diameter/width/offset ranges for ${rangeCount} G-BODY records`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
