const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Get all pre-1985 vehicles grouped by make, model, bolt pattern
  const result = await client`
    SELECT make, model, bolt_pattern, 
           MIN(year) as min_year, MAX(year) as max_year, 
           COUNT(*) as record_count
    FROM vehicle_fitments 
    WHERE year < 1985
    GROUP BY make, model, bolt_pattern
    ORDER BY make, model, min_year
  `;
  
  console.log("Classic vehicles (pre-1985) in database:\n");
  console.log("Make | Model | Bolt Pattern | Years | Count");
  console.log("-----|-------|--------------|-------|------");
  result.forEach(r => {
    console.log(`${r.make} | ${r.model} | ${r.bolt_pattern} | ${r.min_year}-${r.max_year} | ${r.record_count}`);
  });
  
  console.log("\nTotal records:", result.reduce((sum, r) => sum + parseInt(r.record_count), 0));
  
  await client.end();
}

main().catch(console.error);