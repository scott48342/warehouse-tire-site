import pg from 'pg';
import fs from 'fs';

// Parse .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envMatch = envContent.match(/^POSTGRES_URL=["']?([^"'\r\n]+)["']?$/m);
const POSTGRES_URL = envMatch ? envMatch[1].trim() : null;
if (!POSTGRES_URL) throw new Error('POSTGRES_URL not found in .env.local');

const { Pool } = pg;
const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const sku = process.argv[2] || 'IHR0144K';

const result = await pool.query(`
  SELECT sku, brand_desc, tire_description, tire_size, map_usd, msrp_usd
  FROM wp_tires 
  WHERE sku = $1
`, [sku]);

if (result.rows.length === 0) {
  console.log(`Tire SKU "${sku}" NOT FOUND in wp_tires`);
  
  // Check if it looks like a WheelPros SKU pattern
  const countResult = await pool.query(`SELECT COUNT(*) FROM wp_tires`);
  console.log(`Total tires in wp_tires: ${countResult.rows[0].count}`);
  
  // Sample some SKUs
  const sampleResult = await pool.query(`SELECT sku FROM wp_tires LIMIT 5`);
  console.log('Sample SKUs:', sampleResult.rows.map(r => r.sku));
} else {
  console.log('Found:', JSON.stringify(result.rows[0], null, 2));
}

await pool.end();
