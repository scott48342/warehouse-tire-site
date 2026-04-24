import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Test the normalized model matching
const model = "Encore GX";
const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalized = model.toLowerCase().replace(/[^a-z0-9]+/g, '');

console.log(`Input: "${model}"`);
console.log(`Slugified: "${slugified}"`);
console.log(`Normalized: "${normalized}"`);

// Test SQL query directly
const result = await pool.query(`
  SELECT year, make, model, display_trim, modification_id,
    lower(regexp_replace(model, '[^a-zA-Z0-9]', '', 'g')) as normalized_model
  FROM vehicle_fitments 
  WHERE year = 2022 
    AND lower(make) = 'buick'
    AND lower(regexp_replace(model, '[^a-zA-Z0-9]', '', 'g')) = $1
  LIMIT 10
`, [normalized]);

console.log(`\nQuery results (${result.rows.length}):`);
result.rows.forEach(row => {
  console.log(`  ${row.display_trim}: model="${row.model}", normalized="${row.normalized_model}"`);
});

await pool.end();
