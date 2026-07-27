const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Check classic_fitments table
  const tables = await client`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%classic%'
  `;
  console.log("Classic-related tables:", tables.map(t => t.table_name).join(", "));
  
  // Check for Camaro and Malibu in classic_fitments
  const camaro = await client`
    SELECT make, model, year_start, year_end, common_bolt_pattern, common_offset_min, common_offset_max
    FROM classic_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) LIKE '%camaro%'
  `;
  console.log("\nCamaro in classic_fitments:", camaro.length);
  if (camaro.length > 0) camaro.forEach(c => console.log("  ", JSON.stringify(c)));
  
  const malibu = await client`
    SELECT make, model, year_start, year_end, common_bolt_pattern, common_offset_min, common_offset_max
    FROM classic_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) LIKE '%malibu%'
  `;
  console.log("\nMalibu in classic_fitments:", malibu.length);
  if (malibu.length > 0) malibu.forEach(c => console.log("  ", JSON.stringify(c)));
  
  // Total records in classic_fitments
  const total = await client`SELECT COUNT(*) as cnt FROM classic_fitments`;
  console.log("\nTotal classic_fitments records:", total[0].cnt);
  
  await client.end();
}

main().catch(console.error);