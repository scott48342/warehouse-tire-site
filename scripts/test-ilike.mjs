import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const model = "Encore GX";  // From URL
const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const words = slugified.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
const pattern = `%${words.join('%')}%`;

console.log("Input model:", model);
console.log("Slugified:", slugified);
console.log("Pattern:", pattern);

const result = await pool.query(`
  SELECT id, model, display_trim, modification_id
  FROM vehicle_fitments 
  WHERE year = 2022 
    AND lower(make) = 'buick'
    AND model ILIKE $1
    AND modification_id = 'buick-encore-gx-preferred-ff350f80'
  LIMIT 5
`, [pattern]);

console.log(`\nILIKE results (${result.rows.length}):`);
result.rows.forEach(row => {
  console.log(`  ${row.display_trim}: model="${row.model}", mod_id=${row.modification_id}`);
});

await pool.end();
