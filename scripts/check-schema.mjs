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
    console.log('=== Trim/Submodel Data Audit ===\n');
    
    // Count distinct display_trims
    const trimCount = await client.query(`
      SELECT COUNT(DISTINCT display_trim) as count 
      FROM vehicle_fitments 
      WHERE display_trim IS NOT NULL AND display_trim != ''
    `);
    console.log('Distinct display_trims:', trimCount.rows[0].count);
    
    // Count distinct submodels
    const submodelCount = await client.query(`
      SELECT COUNT(DISTINCT submodel) as count 
      FROM vehicle_fitments 
      WHERE submodel IS NOT NULL AND submodel != ''
    `);
    console.log('Distinct submodels:', submodelCount.rows[0].count);
    
    // Sample display_trims
    const sampleTrims = await client.query(`
      SELECT DISTINCT display_trim 
      FROM vehicle_fitments 
      WHERE display_trim IS NOT NULL AND display_trim != '' 
      LIMIT 20
    `);
    console.log('\nSample display_trims:', sampleTrims.rows.map(r => r.display_trim));
    
    // Sample submodels
    const sampleSubmodels = await client.query(`
      SELECT DISTINCT submodel 
      FROM vehicle_fitments 
      WHERE submodel IS NOT NULL AND submodel != '' 
      LIMIT 20
    `);
    console.log('\nSample submodels:', sampleSubmodels.rows.map(r => r.submodel));
    
    // Check 2024 Ford F-150 trims
    const f150Trims = await client.query(`
      SELECT DISTINCT display_trim, submodel, modification_id, bolt_pattern
      FROM vehicle_fitments 
      WHERE year = 2024 AND LOWER(make) = 'ford' AND LOWER(model) = 'f-150'
      ORDER BY display_trim
    `);
    console.log('\n2024 Ford F-150 trims:', f150Trims.rows);
    
    // Check 2022 Buick Encore 
    const encoreTrims = await client.query(`
      SELECT DISTINCT year, display_trim, submodel, modification_id, bolt_pattern
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%'
      ORDER BY year DESC, display_trim
      LIMIT 20
    `);
    console.log('\nBuick Encore data:', encoreTrims.rows);
    
    // Check overall breakdown
    const breakdown = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE submodel IS NULL OR submodel = '') as no_submodel,
        COUNT(*) FILTER (WHERE submodel IS NOT NULL AND submodel != '') as has_submodel,
        COUNT(*) FILTER (WHERE display_trim IS NULL OR display_trim = '') as no_display_trim,
        COUNT(*) FILTER (WHERE display_trim IS NOT NULL AND display_trim != '') as has_display_trim,
        COUNT(*) as total
      FROM vehicle_fitments
    `);
    console.log('\nData breakdown:', breakdown.rows[0]);
    
    // Find vehicles with multiple trims
    const multiTrimVehicles = await client.query(`
      SELECT year, make, model, COUNT(DISTINCT display_trim) as trim_count
      FROM vehicle_fitments
      GROUP BY year, make, model
      HAVING COUNT(DISTINCT display_trim) > 1
      ORDER BY trim_count DESC
      LIMIT 15
    `);
    console.log('\nVehicles with multiple trims:', multiTrimVehicles.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
