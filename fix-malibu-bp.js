// Fix 1965 Malibu bolt pattern
const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const { sql } = require("drizzle-orm");

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.log("No POSTGRES_URL");
    process.exit(1);
  }
  
  const client = postgres(connectionString);
  const db = drizzle(client);
  
  // Fix 1965 Malibu
  const result = await db.execute(sql`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65'
    WHERE year = 1965 
    AND LOWER(make) = 'chevrolet' 
    AND LOWER(model) = 'malibu'
    RETURNING modification_id, bolt_pattern
  `);
  
  console.log("Updated:", JSON.stringify(result, null, 2));
  
  // Check all classic Chevys with wrong bolt pattern
  const check = await db.execute(sql`
    SELECT year, make, model, display_trim, bolt_pattern 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' 
    AND year BETWEEN 1960 AND 1979
    AND bolt_pattern = '5x115'
    ORDER BY year, model
  `);
  
  console.log("Other classic Chevys with 5x115 (WRONG):", check.length);
  check.forEach(r => console.log(`${r.year} ${r.model} ${r.display_trim}: ${r.bolt_pattern}`));
  
  await client.end();
}

main().catch(console.error);
