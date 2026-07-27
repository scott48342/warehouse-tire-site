const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Fix 1969 Camaro Base trim to match other trims
  const result = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro'
    AND year = 1969 AND LOWER(display_trim) = 'base'
    RETURNING modification_id, bolt_pattern, center_bore_mm
  `;
  
  console.log("Fixed 1969 Camaro Base:", result.length, "records");
  result.forEach(r => console.log(`  ${r.modification_id}: ${r.bolt_pattern}, hub=${r.center_bore_mm}`));
  
  // Check for other Camaro years with 5x120 (wrong)
  const wrongBp = await client`
    SELECT year, display_trim, bolt_pattern, center_bore_mm
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro'
    AND bolt_pattern = '5x120'
    ORDER BY year
  `;
  
  if (wrongBp.length > 0) {
    console.log("\nOther Camaro records with 5x120 (need fixing):");
    wrongBp.forEach(r => console.log(`  ${r.year} ${r.display_trim}: ${r.bolt_pattern}`));
  }
  
  await client.end();
}

main().catch(console.error);