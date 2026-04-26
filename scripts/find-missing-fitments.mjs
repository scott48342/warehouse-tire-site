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

const allMissing = [];

for (const make of makes) {
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE (make ILIKE $1 OR make ILIKE $2)
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]' OR oem_tire_sizes::text = 'null')
    ORDER BY year, model, display_trim
    LIMIT 100
  `, [make, `%${make}%`]);
  
  if (result.rows.length > 0) {
    console.log(`\n=== ${make} (${result.rows.length} missing) ===`);
    for (const r of result.rows) {
      console.log(`  ${r.id}: ${r.year} ${r.make} ${r.model} ${r.display_trim || 'Base'}`);
      allMissing.push(r);
    }
  }
}

console.log(`\n\nTOTAL MISSING: ${allMissing.length}`);

// Write to JSON for processing
fs.writeFileSync('scripts/missing-fitments.json', JSON.stringify(allMissing, null, 2));
console.log('Wrote missing fitments to scripts/missing-fitments.json');

await pool.end();
