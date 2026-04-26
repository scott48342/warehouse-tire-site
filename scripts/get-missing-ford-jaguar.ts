import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";
import * as fs from 'fs';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function getMissing() {
  console.log('Querying database for missing fitments...');
  
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim, modification_id,
           oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE make IN ('Ford', 'Jaguar')
      AND (
        oem_wheel_sizes IS NULL 
        OR oem_wheel_sizes = '[]'::jsonb
        OR oem_tire_sizes IS NULL 
        OR oem_tire_sizes = '[]'::jsonb
      )
    ORDER BY make, model, year, display_trim
  `);
  
  const rows = result.rows;
  const ford = rows.filter((r: any) => r.make === 'Ford');
  const jaguar = rows.filter((r: any) => r.make === 'Jaguar');
  
  console.log(`FORD: ${ford.length} missing`);
  console.log(`JAGUAR: ${jaguar.length} missing`);
  
  // Group by model
  const fordModels: Record<string, any[]> = {};
  ford.forEach((r: any) => {
    if (!fordModels[r.model]) fordModels[r.model] = [];
    fordModels[r.model].push({
      id: r.id, 
      year: r.year, 
      trim: r.display_trim,
      modificationId: r.modification_id
    });
  });
  
  const jagModels: Record<string, any[]> = {};
  jaguar.forEach((r: any) => {
    if (!jagModels[r.model]) jagModels[r.model] = [];
    jagModels[r.model].push({
      id: r.id, 
      year: r.year, 
      trim: r.display_trim,
      modificationId: r.modification_id
    });
  });
  
  console.log('\n=== FORD MODELS ===');
  Object.keys(fordModels).sort().forEach(model => {
    console.log(`${model}: ${fordModels[model].length}`);
  });
  
  console.log('\n=== JAGUAR MODELS ===');
  Object.keys(jagModels).sort().forEach(model => {
    console.log(`${model}: ${jagModels[model].length}`);
  });
  
  // Write full data to file
  const output = {
    ford: fordModels,
    jaguar: jagModels,
    total: ford.length + jaguar.length
  };
  
  fs.writeFileSync('./scripts/missing-ford-jaguar.json', JSON.stringify(output, null, 2));
  console.log('\nWrote full data to scripts/missing-ford-jaguar.json');
  
  await pool.end();
  process.exit(0);
}

getMissing().catch(err => {
  console.error(err);
  process.exit(1);
});
