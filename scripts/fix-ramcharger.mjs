import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const oemWheelSizes = [{ diameter: 15, width: 8, offset: null, axle: 'square', isStock: true }];
  const oemTireSizes = ['P235/75R15'];
  const boltPattern = '5x139.7';
  const centerBore = 108;
  
  const result = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_wheel_sizes = $1::jsonb, 
        oem_tire_sizes = $2::jsonb, 
        bolt_pattern = $3, 
        center_bore_mm = $4, 
        source = 'trim-research', 
        quality_tier = 'complete', 
        updated_at = NOW() 
    WHERE make = 'Dodge' 
    AND model = 'Ramcharger'
    AND quality_tier != 'complete'
    RETURNING year, model
  `, [JSON.stringify(oemWheelSizes), JSON.stringify(oemTireSizes), boltPattern, centerBore]);
  
  console.log(`Updated ${result.rowCount} Ramcharger records:`);
  result.rows.forEach(r => console.log(`  ${r.year} ${r.model}`));
  
  await pool.end();
}

run();
