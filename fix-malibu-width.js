const postgres = require("postgres");

async function main() {
  const client = postgres("postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require");
  
  // Fix width range for all classic Malibus (1964-1972) - allow up to 9.5" width
  const result = await client`
    UPDATE vehicle_fitments 
    SET width_max = 9.5
    WHERE LOWER(make) = 'chevrolet' 
    AND LOWER(model) = 'malibu'
    AND year BETWEEN 1964 AND 1972
    RETURNING year, modification_id, width_min, width_max
  `;
  
  console.log("Updated width range for", result.length, "records:");
  result.forEach(r => console.log(r.year + " " + r.modification_id + ": width " + r.width_min + "-" + r.width_max));
  
  await client.end();
}

main().catch(console.error);