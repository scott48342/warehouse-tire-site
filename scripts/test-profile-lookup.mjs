import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

const year = 2022;
const make = "Buick";
const model = "Encore GX";
const modificationId = "buick-encore-gx-preferred-ff350f80";

// Normalize make
const normalizedMake = make.toLowerCase();

// Get model variants (same as getModelVariants)
const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const modelVariants = [slugified];
console.log("Model variants:", modelVariants);

// Normalize variants
const normalizedVariants = modelVariants.map(m => 
  m.toLowerCase().replace(/[^a-z0-9]+/g, '')
);
console.log("Normalized variants:", normalizedVariants);

const normalizedModId = modificationId.toLowerCase().trim();
console.log("Normalized mod ID:", normalizedModId);

// Test direct query matching what profileService should do
const result = await pool.query(`
  SELECT id, modification_id, display_trim, model, 
    lower(regexp_replace(model, '[^a-zA-Z0-9]', '', 'g')) as norm_model
  FROM vehicle_fitments 
  WHERE year = $1 
    AND lower(make) = $2
    AND lower(regexp_replace(model, '[^a-zA-Z0-9]', '', 'g')) = $3
    AND modification_id = $4
  LIMIT 5
`, [year, normalizedMake, normalizedVariants[0], normalizedModId]);

console.log(`\nDirect lookup results (${result.rows.length}):`);
result.rows.forEach(row => {
  console.log(`  ${row.display_trim}: model="${row.model}", norm="${row.norm_model}", mod_id=${row.modification_id}`);
});

await pool.end();
