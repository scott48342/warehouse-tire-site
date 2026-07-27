const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  const camaro = await client`
    SELECT year, make, model, modification_id, oem_wheel_sizes 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
    LIMIT 1
  `;
  
  console.log("1969 Camaro fitment data:");
  console.log("OEM Wheel Sizes:", JSON.stringify(camaro[0].oem_wheel_sizes, null, 2));
  
  // Check what offset data is there
  const cols = await client`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments' 
    AND column_name LIKE '%offset%'
  `;
  console.log("\nOffset-related columns:", cols.map(c => c.column_name).join(", "));
  
  await client.end();
}

main().catch(console.error);