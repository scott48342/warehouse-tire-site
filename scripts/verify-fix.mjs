import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const makes = ['Subaru', 'Cadillac', 'Nissan', 'Volkswagen', 'Mercedes-Benz', 'GMC', 'INFINITI', 'MINI', 'Lincoln'];

console.log('=== VERIFICATION REPORT ===\n');

let totalFixed = 0;
let totalMissing = 0;

for (const make of makes) {
  // Count total records for this make
  const totalResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM vehicle_fitments 
    WHERE make ILIKE $1 OR make ILIKE $2
  `, [make, `%${make}%`]);
  
  // Count records WITH fitment data
  const fixedResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM vehicle_fitments 
    WHERE (make ILIKE $1 OR make ILIKE $2)
      AND oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]' 
      AND oem_tire_sizes::text != 'null'
  `, [make, `%${make}%`]);

  // Count records WITHOUT fitment data
  const missingResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM vehicle_fitments 
    WHERE (make ILIKE $1 OR make ILIKE $2)
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]' OR oem_tire_sizes::text = 'null')
  `, [make, `%${make}%`]);

  const total = parseInt(totalResult.rows[0].count);
  const fixed = parseInt(fixedResult.rows[0].count);
  const missing = parseInt(missingResult.rows[0].count);
  
  totalFixed += fixed;
  totalMissing += missing;
  
  const status = missing === 0 ? '✅' : '⚠️';
  console.log(`${status} ${make}:`);
  console.log(`   Total: ${total} | With Fitment: ${fixed} | Missing: ${missing}`);
}

console.log('\n========================================');
console.log('TOTALS:');
console.log(`  With Fitment Data: ${totalFixed} records`);
console.log(`  Missing Fitment:   ${totalMissing} records`);
console.log(`  Coverage: ${((totalFixed / (totalFixed + totalMissing)) * 100).toFixed(1)}%`);
console.log('========================================\n');

await pool.end();
