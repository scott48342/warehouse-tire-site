// Fix ALL classic Malibu bolt patterns (1964-1972)
const postgres = require("postgres");

async function main() {
  const client = postgres("postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require");
  
  // Fix all 1964-1972 Malibu
  const result = await client
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65'
    WHERE LOWER(make) = 'chevrolet' 
    AND LOWER(model) = 'malibu'
    AND year BETWEEN 1964 AND 1972
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id, bolt_pattern
  ;
  
  console.log("Fixed", result.length, "records:");
  result.forEach(r => console.log("  " + r.year + ": " + r.modification_id + " -> " + r.bolt_pattern));
  
  await client.end();
}

main().catch(console.error);
