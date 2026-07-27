const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Check what models exist for these makes/years
  const camaro = await client`
    SELECT year, make, model, bolt_pattern, modification_id 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) LIKE '%camaro%' AND year = 1969
  `;
  console.log("1969 Camaro records:", camaro.length);
  camaro.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.bolt_pattern}`));
  
  const challenger = await client`
    SELECT year, make, model, bolt_pattern, modification_id 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'dodge' AND LOWER(model) LIKE '%challenger%' AND year = 1970
  `;
  console.log("\n1970 Challenger records:", challenger.length);
  challenger.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.bolt_pattern}`));
  
  const charger = await client`
    SELECT year, make, model, bolt_pattern, modification_id 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'dodge' AND LOWER(model) LIKE '%charger%' AND year = 1969
  `;
  console.log("\n1969 Charger records:", charger.length);
  charger.forEach(r => console.log(`  ${r.year} ${r.make} ${r.model}: ${r.bolt_pattern}`));
  
  await client.end();
}

main().catch(console.error);