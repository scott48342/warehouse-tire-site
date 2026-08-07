require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Check Ram models - might be under different naming
    console.log('=== RAM TRUCK CHECK ===\n');
    
    const ramSearch = await client.query(`
      SELECT DISTINCT make, model, COUNT(*) as cnt, MIN(year) as min_y, MAX(year) as max_y
      FROM vehicle_fitments
      WHERE (make ILIKE '%ram%' OR model ILIKE '%ram%' OR model ILIKE '%1500%' OR model ILIKE '%2500%')
        AND year >= 2000
      GROUP BY make, model
      ORDER BY make, model
    `);
    console.log('Records containing "Ram" or "1500/2500":');
    ramSearch.rows.forEach(r => console.log(`  ${r.make} ${r.model}: ${r.min_y}-${r.max_y} (${r.cnt})`));
    
    // Check if Ram is under Dodge
    console.log('\n\nDodge Ram search:');
    const dodgeRam = await client.query(`
      SELECT DISTINCT model, COUNT(*) as cnt, MIN(year) as min_y, MAX(year) as max_y
      FROM vehicle_fitments
      WHERE make = 'Dodge' AND model ILIKE '%ram%'
      GROUP BY model
    `);
    dodgeRam.rows.forEach(r => console.log(`  Dodge ${r.model}: ${r.min_y}-${r.max_y} (${r.cnt})`));
    
    // Corvette hub bore check
    console.log('\n\n=== CORVETTE HUB BORE CHECK ===\n');
    const corvette = await client.query(`
      SELECT year, display_trim, center_bore_mm, bolt_pattern
      FROM vehicle_fitments
      WHERE make = 'Chevrolet' AND model ILIKE '%corvette%'
        AND year >= 2020
      ORDER BY year, display_trim
    `);
    console.log('Recent Corvette hub bores:');
    corvette.rows.forEach(r => console.log(`  ${r.year} ${r.display_trim || 'Base'}: ${r.center_bore_mm}mm (${r.bolt_pattern})`));
    
    // Check missing hub bore records
    console.log('\n\n=== MISSING HUB BORE RECORDS ===\n');
    const missingHub = await client.query(`
      SELECT year, make, model, display_trim, bolt_pattern
      FROM vehicle_fitments
      WHERE center_bore_mm IS NULL
        AND year >= 2000
        AND make IN ('Ford', 'Chevrolet', 'Dodge', 'Ram', 'GMC', 'Jeep')
      ORDER BY make, model, year
    `);
    console.log(`Total with missing hub bore: ${missingHub.rows.length}`);
    missingHub.rows.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim || ''}`));
    
    // Check Bronco Sport
    console.log('\n\n=== BRONCO SPORT CHECK ===\n');
    const broncoSport = await client.query(`
      SELECT year, display_trim, bolt_pattern, center_bore_mm
      FROM vehicle_fitments
      WHERE make = 'Ford' AND model ILIKE '%bronco sport%'
      ORDER BY year
    `);
    console.log(`Bronco Sport records: ${broncoSport.rows.length}`);
    broncoSport.rows.forEach(r => console.log(`  ${r.year} ${r.display_trim || 'Base'}: ${r.bolt_pattern}, ${r.center_bore_mm}mm`));
    
    // Check Cruze
    console.log('\n\n=== CRUZE CHECK ===\n');
    const cruze = await client.query(`
      SELECT year, display_trim, bolt_pattern, center_bore_mm
      FROM vehicle_fitments
      WHERE make = 'Chevrolet' AND model ILIKE '%cruze%'
      ORDER BY year
    `);
    console.log(`Cruze records: ${cruze.rows.length}`);
    cruze.rows.forEach(r => console.log(`  ${r.year} ${r.display_trim || 'Base'}: ${r.bolt_pattern}, ${r.center_bore_mm}mm`));
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
