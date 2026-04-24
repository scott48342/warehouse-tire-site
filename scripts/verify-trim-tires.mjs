import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function verify() {
  const client = await pool.connect();
  
  try {
    console.log('=== VERIFY TRIM-LEVEL TIRE DATA ===\n');
    
    // Check Honda Accord
    console.log('--- 2024 Honda Accord ---');
    const accord = await client.query(`
      SELECT display_trim, oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE year = 2024 AND LOWER(make) = 'honda' AND LOWER(model) = 'accord'
        AND source = 'verified-research'
      ORDER BY display_trim
    `);
    for (const r of accord.rows) {
      console.log(`  ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)} | wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    }
    
    // Check Toyota Camry
    console.log('\n--- 2025 Toyota Camry ---');
    const camry = await client.query(`
      SELECT display_trim, oem_tire_sizes, oem_wheel_sizes
      FROM vehicle_fitments
      WHERE year = 2025 AND LOWER(make) = 'toyota' AND LOWER(model) = 'camry'
        AND source = 'verified-research'
      ORDER BY display_trim
    `);
    for (const r of camry.rows) {
      console.log(`  ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)} | wheels: ${JSON.stringify(r.oem_wheel_sizes)}`);
    }
    
    // Check Buick Encore GX
    console.log('\n--- 2024 Buick Encore GX ---');
    const encoreGx = await client.query(`
      SELECT display_trim, oem_tire_sizes, oem_wheel_sizes, bolt_pattern
      FROM vehicle_fitments
      WHERE year = 2024 AND LOWER(make) = 'buick' AND LOWER(model) LIKE '%encore%gx%'
        AND source = 'verified-research'
      ORDER BY display_trim
    `);
    for (const r of encoreGx.rows) {
      console.log(`  ${r.display_trim} [${r.bolt_pattern}]: ${JSON.stringify(r.oem_tire_sizes)}`);
    }
    
    // Count verified-research records
    const verifiedCount = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE source = 'verified-research'
    `);
    console.log(`\nTotal verified-research records: ${verifiedCount.rows[0].cnt}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

verify().catch(console.error);
