// Fix ALL classic Malibu bolt patterns (1964-1972)
const postgres = require("postgres");
const { drizzle } = require("drizzle-orm/postgres-js");
const { sql } = require("drizzle-orm");

async function main() {
  const client = postgres(process.env.POSTGRES_URL);
  const db = drizzle(client);
  
  // Fix all 1964-1972 Malibu
  const result = await db.execute(sql`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65'
    WHERE LOWER(make) = 'chevrolet' 
    AND LOWER(model) = 'malibu'
    AND year BETWEEN 1964 AND 1972
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id, bolt_pattern
  `);
  
  console.log("Fixed", result.length, "records:");
  result.forEach(r => console.log(`  ${r.year}: ${r.modification_id} -> ${r.bolt_pattern}`));
  
  // Now check if there are any OTHER classic GM vehicles with wrong bolt pattern
  const otherWrong = await db.execute(sql`
    SELECT year, make, model, display_trim, bolt_pattern 
    FROM vehicle_fitments 
    WHERE year BETWEEN 1960 AND 1985
    AND bolt_pattern = '5x115'
    ORDER BY make, model, year
    LIMIT 50
  `);
  
  if (otherWrong.length > 0) {
    console.log("\nOther pre-1985 vehicles with 5x115 (may be wrong):");
    otherWrong.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.bolt_pattern}`));
  } else {
    console.log("\nNo other pre-1985 vehicles with 5x115 found");
  }
  
  await client.end();
}

main().catch(console.error);
