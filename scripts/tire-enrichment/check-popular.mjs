import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Check popular US models
const popularModels = [
  'f-150', 'silverado', 'mustang', 'camaro', 'corvette', 
  'tacoma', 'tundra', 'wrangler', 'grand-cherokee', 'civic',
  'accord', 'cr-v', 'rav4', 'camry', 'highlander', 'pilot',
  'explorer', 'escape', 'bronco', 'tahoe', 'suburban'
];

console.log("Checking popular US models for missing tire sizes:\n");

for (const model of popularModels) {
  const result = await pool.query(`
    SELECT COUNT(*) as missing FROM vehicle_fitments 
    WHERE LOWER(model) = $1
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '' OR oem_tire_sizes::text = '[]')
  `, [model]);
  
  const total = await pool.query(`
    SELECT COUNT(*) as total FROM vehicle_fitments WHERE LOWER(model) = $1
  `, [model]);
  
  const missingCount = parseInt(result.rows[0].missing);
  const totalCount = parseInt(total.rows[0].total);
  
  if (missingCount > 0) {
    console.log(`${model}: ${missingCount}/${totalCount} missing`);
  }
}

await pool.end();
