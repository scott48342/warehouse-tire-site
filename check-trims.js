const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Get all 1969 Camaro trims
  const camaros = await client`
    SELECT modification_id, display_trim, offset_min_mm, offset_max_mm, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
  `;
  
  console.log("All 1969 Camaro records:");
  camaros.forEach(c => {
    const sizes = typeof c.oem_wheel_sizes === 'string' ? JSON.parse(c.oem_wheel_sizes) : c.oem_wheel_sizes;
    const hasStockOffset = sizes?.some(s => s.isStock && s.offset !== null);
    console.log(`  ${c.modification_id} (${c.display_trim}): offset ${c.offset_min_mm}-${c.offset_max_mm}, hasStockOffset: ${hasStockOffset}`);
  });
  
  await client.end();
}

main().catch(console.error);