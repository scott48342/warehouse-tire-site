const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  const camaro = await client`
    SELECT year, make, model, modification_id, offset_min_mm, offset_max_mm
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
    LIMIT 1
  `;
  
  console.log("1969 Camaro:");
  console.log("  offset_min_mm:", camaro[0].offset_min_mm);
  console.log("  offset_max_mm:", camaro[0].offset_max_mm);
  
  // Check the Malibu that was working
  const malibu = await client`
    SELECT year, make, model, modification_id, offset_min_mm, offset_max_mm
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'malibu' AND year = 1965
    LIMIT 1
  `;
  
  console.log("\n1965 Malibu:");
  console.log("  offset_min_mm:", malibu[0].offset_min_mm);
  console.log("  offset_max_mm:", malibu[0].offset_max_mm);
  
  await client.end();
}

main().catch(console.error);