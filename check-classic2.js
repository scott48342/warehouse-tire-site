const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Get columns for classic_fitments
  const cols = await client`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'classic_fitments'
    ORDER BY ordinal_position
  `;
  console.log("classic_fitments columns:", cols.map(c => c.column_name).join(", "));
  
  // Check for Camaro and Malibu in classic_fitments
  const camaro = await client`
    SELECT make, model, year_start, year_end, common_bolt_pattern
    FROM classic_fitments 
    WHERE LOWER(make) = 'chevrolet' AND LOWER(model) LIKE '%camaro%'
  `;
  console.log("\nCamaro in classic_fitments:", camaro.length);
  if (camaro.length > 0) camaro.forEach(c => console.log("  ", JSON.stringify(c)));
  
  const malibu = await client`
    SELECT make, model, year_start, year_end, common_bolt_pattern
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