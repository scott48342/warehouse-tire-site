import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const { Pool } = pg;

async function checkMissing() {
  console.log('Querying missing records...');
  
  const connStr = process.env.POSTGRES_URL || '';
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });
  
  const client = await pool.connect();
  try {
    // Find records with empty/null wheel or tire sizes
    const result = await client.query(`
      SELECT id, year, make, model, display_trim, modification_id, 
             oem_wheel_sizes, oem_tire_sizes, bolt_pattern
      FROM vehicle_fitments
      WHERE oem_wheel_sizes = '[]'::jsonb 
         OR oem_wheel_sizes IS NULL
         OR oem_tire_sizes = '[]'::jsonb
         OR oem_tire_sizes IS NULL
      ORDER BY make, model, year, display_trim
    `);
    
    const missing = result.rows;
    console.log('Total missing:', missing.length);
    
    // Group by make
    const byMake = {};
    for (const r of missing) {
      const make = r.make;
      if (!byMake[make]) byMake[make] = [];
      byMake[make].push(r);
    }
    
    console.log('\n=== BUICK MISSING ===');
    const buick = byMake['Buick'] || [];
    const buickByModel = {};
    for (const r of buick) {
      if (!buickByModel[r.model]) buickByModel[r.model] = [];
      buickByModel[r.model].push(r);
    }
    for (const [model, records] of Object.entries(buickByModel)) {
      console.log(`${model}: ${records.length}`);
      // Show sample
      const sample = records[0];
      console.log(`  Sample: ${sample.year} ${sample.display_trim}`);
    }
    console.log('Total Buick:', buick.length);
    
    console.log('\n=== CHEVROLET MISSING ===');
    const chevy = byMake['Chevrolet'] || [];
    const chevyByModel = {};
    for (const r of chevy) {
      if (!chevyByModel[r.model]) chevyByModel[r.model] = [];
      chevyByModel[r.model].push(r);
    }
    for (const [model, records] of Object.entries(chevyByModel)) {
      console.log(`${model}: ${records.length}`);
      // Show sample
      const sample = records[0];
      console.log(`  Sample: ${sample.year} ${sample.display_trim}`);
    }
    console.log('Total Chevrolet:', chevy.length);
    
    // Export to JSON for inspection
    const output = {
      buick: buick,
      chevrolet: chevy
    };
    
    fs.writeFileSync('scripts/missing-buick-chevy.json', JSON.stringify(output, null, 2));
    console.log('\nExported to scripts/missing-buick-chevy.json');
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkMissing().catch(err => {
  console.error(err);
  process.exit(1);
});
