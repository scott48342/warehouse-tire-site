import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function check() {
  const client = await pool.connect();
  
  try {
    console.log('Checking trim data in vehicle_fitments...\n');
    
    // Count total records
    const totalResult = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
    console.log('Total fitment records:', totalResult.rows[0].count);
    
    // Count distinct non-empty trims
    const trimCount = await client.query(`
      SELECT COUNT(DISTINCT trim) as count 
      FROM vehicle_fitments 
      WHERE trim IS NOT NULL AND trim != ''
    `);
    console.log('Distinct non-empty trims:', trimCount.rows[0].count);
    
    // Sample trims
    const sampleTrims = await client.query(`
      SELECT DISTINCT trim 
      FROM vehicle_fitments 
      WHERE trim IS NOT NULL AND trim != '' 
      LIMIT 20
    `);
    console.log('\nSample trims:', sampleTrims.rows.map(r => r.trim));
    
    // Check Buick Encore
    const encoreTrims = await client.query(`
      SELECT DISTINCT year, trim, modification_id, bolt_pattern 
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%' 
      ORDER BY year DESC 
      LIMIT 20
    `);
    console.log('\nBuick Encore data:', encoreTrims.rows);
    
    // Check Ford F-150 trims (should have many)
    const f150Trims = await client.query(`
      SELECT DISTINCT year, trim, modification_id 
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'ford' AND LOWER(model) = 'f-150' AND year = 2024
      ORDER BY trim
    `);
    console.log('\n2024 Ford F-150 trims:', f150Trims.rows);
    
    // Check if trim column is mostly empty
    const emptyTrims = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE trim IS NULL OR trim = '') as empty_trims,
        COUNT(*) FILTER (WHERE trim IS NOT NULL AND trim != '') as has_trim,
        COUNT(*) as total
      FROM vehicle_fitments
    `);
    console.log('\nTrim data breakdown:', emptyTrims.rows[0]);
    
    // Check what the trims API would return
    const trimsAPITest = await client.query(`
      SELECT DISTINCT trim, modification_id 
      FROM vehicle_fitments 
      WHERE year = 2024 AND make ILIKE 'ford' AND model ILIKE 'f-150'
      ORDER BY trim
    `);
    console.log('\nTrims API test (2024 Ford F-150):', trimsAPITest.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
