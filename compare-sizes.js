const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  const camaro = await client`
    SELECT year, make, model, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
    LIMIT 1
  `;
  
  const malibu = await client`
    SELECT year, make, model, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'malibu' AND year = 1965
    LIMIT 1
  `;
  
  console.log("1969 Camaro oem_wheel_sizes:");
  const camaroSizes = JSON.parse(camaro[0].oem_wheel_sizes);
  camaroSizes.forEach(s => console.log("  ", JSON.stringify(s)));
  
  console.log("\n1965 Malibu oem_wheel_sizes:");
  const malibuSizes = JSON.parse(malibu[0].oem_wheel_sizes);
  malibuSizes.forEach(s => console.log("  ", JSON.stringify(s)));
  
  await client.end();
}

main().catch(console.error);