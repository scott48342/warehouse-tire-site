const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Fix classic Camaro (1967-2002) from 5x120 to 5x120.65
  // Modern Camaros (2010+) correctly use 5x120
  const result = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65', center_bore_mm = 70.3
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'camaro'
    AND year BETWEEN 1967 AND 2002
    AND bolt_pattern = '5x120'
    RETURNING year, display_trim, bolt_pattern
  `;
  
  console.log("Fixed classic Camaro (1967-2002) bolt patterns:", result.length, "records");
  result.forEach(r => console.log(`  ${r.year} ${r.display_trim}: ${r.bolt_pattern}`));
  
  await client.end();
}

main().catch(console.error);