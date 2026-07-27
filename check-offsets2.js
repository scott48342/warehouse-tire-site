const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Get all 1969 Camaro trims with their offset data
  const camaros = await client`
    SELECT modification_id, display_trim, offset_min_mm, offset_max_mm
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
    ORDER BY display_trim
  `;
  
  console.log("All 1969 Camaro records with offset data:");
  camaros.forEach(c => {
    const hasOffset = c.offset_min_mm !== null && c.offset_max_mm !== null;
    console.log(`  ${c.display_trim}: min=${c.offset_min_mm}, max=${c.offset_max_mm}, hasOffset=${hasOffset}`);
  });
  
  // Get the first/default one that would be selected
  const base = await client`
    SELECT modification_id, display_trim, offset_min_mm, offset_max_mm
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
    AND LOWER(display_trim) = 'base'
  `;
  
  if (base.length > 0) {
    console.log("\nBase trim offset data:");
    console.log("  offset_min_mm:", base[0].offset_min_mm, typeof base[0].offset_min_mm);
    console.log("  offset_max_mm:", base[0].offset_max_mm, typeof base[0].offset_max_mm);
  }
  
  await client.end();
}

main().catch(console.error);