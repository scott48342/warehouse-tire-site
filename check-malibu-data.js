const postgres = require("postgres");

async function main() {
  const client = postgres("postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require");
  
  const result = await client`
    SELECT year, oem_wheel_sizes, offset_min_mm, offset_max_mm
    FROM vehicle_fitments 
    WHERE year = 1965 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'malibu'
  `;
  
  console.log("1965 Malibu fitment data:");
  console.log(JSON.stringify(result[0], null, 2));
  
  await client.end();
}

main().catch(console.error);