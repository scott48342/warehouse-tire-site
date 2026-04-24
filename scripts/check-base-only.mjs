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
    // Check Encore trims with bolt patterns
    const encore = await client.query(`
      SELECT year, display_trim, bolt_pattern, modification_id
      FROM vehicle_fitments 
      WHERE LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%'
        AND display_trim NOT LIKE '%,%'
      ORDER BY year DESC, display_trim
      LIMIT 25
    `);
    console.log('Buick Encore individual trims with bolt patterns:');
    console.table(encore.rows);
    
    // Count vehicles with only Base trim (excluding grouped trims)
    const baseOnly = await client.query(`
      WITH vehicle_trims AS (
        SELECT year, make, model, 
               array_agg(DISTINCT display_trim) FILTER (WHERE display_trim NOT LIKE '%,%') as individual_trims
        FROM vehicle_fitments
        GROUP BY year, make, model
      )
      SELECT COUNT(*) as count
      FROM vehicle_trims
      WHERE array_length(individual_trims, 1) = 1 
        AND individual_trims[1] IN ('Base', 'Standard', '1.2T')
    `);
    console.log('\nVehicles with only Base/Standard trim:', baseOnly.rows[0].count);
    
    // Total unique vehicles
    const totalVehicles = await client.query(`
      SELECT COUNT(DISTINCT (year, make, model)) as count FROM vehicle_fitments
    `);
    console.log('Total unique vehicles:', totalVehicles.rows[0].count);
    
    // Sample of base-only vehicles by make
    const baseOnlyByMake = await client.query(`
      WITH vehicle_trims AS (
        SELECT year, make, model, 
               array_agg(DISTINCT display_trim) FILTER (WHERE display_trim NOT LIKE '%,%') as individual_trims
        FROM vehicle_fitments
        GROUP BY year, make, model
      )
      SELECT make, COUNT(*) as base_only_count
      FROM vehicle_trims
      WHERE array_length(individual_trims, 1) = 1 
        AND individual_trims[1] IN ('Base', 'Standard', '1.2T')
      GROUP BY make
      ORDER BY base_only_count DESC
      LIMIT 20
    `);
    console.log('\nBase-only vehicles by make:');
    console.table(baseOnlyByMake.rows);
    
    // Sample popular vehicles with base-only
    const popularBaseOnly = await client.query(`
      WITH vehicle_trims AS (
        SELECT year, make, model, 
               array_agg(DISTINCT display_trim) FILTER (WHERE display_trim NOT LIKE '%,%') as individual_trims
        FROM vehicle_fitments
        GROUP BY year, make, model
      )
      SELECT year, make, model
      FROM vehicle_trims
      WHERE array_length(individual_trims, 1) = 1 
        AND individual_trims[1] IN ('Base', 'Standard')
        AND make IN ('Ford', 'Chevrolet', 'Toyota', 'Honda', 'RAM', 'Jeep', 'Dodge', 'Buick', 'GMC')
      ORDER BY year DESC, make, model
      LIMIT 30
    `);
    console.log('\nPopular vehicles with only Base trim:');
    console.table(popularBaseOnly.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
