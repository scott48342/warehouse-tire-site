import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    // Check what's in DB for Envoy
    const result = await client.query(`
      SELECT year, make, model, display_trim, bolt_pattern, oem_wheel_sizes 
      FROM vehicle_fitments 
      WHERE make = 'GMC' AND model = 'Envoy'
      ORDER BY display_trim
    `);
    
    console.log('Envoy records in DB:', result.rows.length);
    result.rows.forEach(r => {
      console.log(`  ${r.year} ${r.make} ${r.model} - ${r.display_trim}`);
      console.log(`    Bolt: ${r.bolt_pattern}, Wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    });
    
    // Also check if 2006 GMC shows up in models query
    const models = await client.query(`
      SELECT DISTINCT model FROM vehicle_fitments 
      WHERE year = 2006 AND make = 'GMC'
      ORDER BY model
    `);
    console.log('\n2006 GMC models in DB:', models.rows.map(r => r.model).join(', '));
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
