const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  const camaro = await client`
    SELECT year, make, model, modification_id, oem_wheel_sizes, offset_range 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
    LIMIT 1
  `;
  
  console.log("1969 Camaro fitment data:");
  console.log("OEM Wheel Sizes:", JSON.stringify(camaro[0].oem_wheel_sizes, null, 2));
  console.log("Offset Range:", JSON.stringify(camaro[0].offset_range));
  
  await client.end();
}

main().catch(console.error);