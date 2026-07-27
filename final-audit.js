const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  console.log("=== FINAL AUDIT SUMMARY ===\n");
  
  // Check for any remaining suspicious patterns
  const suspicious = await client`
    SELECT DISTINCT make, model, bolt_pattern, MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE bolt_pattern = '5x115'
    AND year < 1971
    GROUP BY make, model, bolt_pattern
    ORDER BY make, model
  `;
  
  if (suspicious.length > 0) {
    console.log("⚠️  Pre-1971 vehicles still with 5x115 (review needed):");
    suspicious.forEach(r => console.log(`   ${r.min_year}-${r.max_year} ${r.make} ${r.model}: ${r.bolt_pattern} (${r.cnt} records)`));
  } else {
    console.log("✅ No pre-1971 vehicles with 5x115 remaining");
  }
  
  // Summary stats
  const stats = await client`
    SELECT 
      bolt_pattern,
      COUNT(*) as count,
      MIN(year) as min_year,
      MAX(year) as max_year
    FROM vehicle_fitments 
    WHERE year < 1990
    GROUP BY bolt_pattern
    ORDER BY count DESC
  `;
  
  console.log("\n=== CLASSIC VEHICLES BY BOLT PATTERN ===\n");
  console.log("Pattern     | Count | Years");
  console.log("------------|-------|--------");
  stats.forEach(r => {
    console.log(`${r.bolt_pattern.padEnd(11)} | ${String(r.count).padStart(5)} | ${r.min_year}-${r.max_year}`);
  });
  
  // Count total classic vehicles
  const total = await client`
    SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE year < 1990
  `;
  console.log("\nTotal pre-1990 vehicle records:", total[0].cnt);
  
  await client.end();
}

main().catch(console.error);