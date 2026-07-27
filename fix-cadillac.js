const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  console.log("=== FIXING CADILLAC/RIVIERA BOLT PATTERNS ===\n");
  
  // Pre-1971 full-size Cadillacs used 5x127 (5x5")
  // 1971-1984 used 5x115
  // So we need to fix 1955-1970 from 5x115 to 5x127
  
  // 1. Fix Cadillac DeVille pre-1971
  const deville = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x127'
    WHERE LOWER(make) = 'cadillac' AND LOWER(model) = 'deville'
    AND year < 1971
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Cadillac DeVille pre-1971:", deville.length, "records -> 5x127");
  
  // 2. Fix Cadillac Eldorado pre-1971
  const eldorado = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x127'
    WHERE LOWER(make) = 'cadillac' AND LOWER(model) = 'eldorado'
    AND year < 1971
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Cadillac Eldorado pre-1971:", eldorado.length, "records -> 5x127");
  
  // 3. Fix Buick Riviera 1963-1970 (first-gen Riviera was on full-size platform, used 5x120.65)
  // Actually Riviera 1963-1970 used 5x120.65 (GM small pattern), not 5x115
  const riviera = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65'
    WHERE LOWER(make) = 'buick' AND LOWER(model) = 'riviera'
    AND year < 1971
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Buick Riviera pre-1971:", riviera.length, "records -> 5x120.65");
  
  console.log("\n=== SUMMARY ===");
  console.log("Total additional records fixed:", deville.length + eldorado.length + riviera.length);
  
  await client.end();
}

main().catch(console.error);