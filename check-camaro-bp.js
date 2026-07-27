const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Get all 1969 Camaro trims with bolt patterns
  const camaros = await client`
    SELECT modification_id, display_trim, bolt_pattern, center_bore_mm
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro' AND year = 1969
    ORDER BY display_trim
  `;
  
  console.log("All 1969 Camaro records:");
  camaros.forEach(c => {
    console.log(`  ${c.display_trim}: ${c.bolt_pattern}, hub=${c.center_bore_mm}`);
  });
  
  await client.end();
}

main().catch(console.error);