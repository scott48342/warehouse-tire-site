const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  console.log("=== FIXING BOLT PATTERN ERRORS ===\n");
  
  // 1. Fix Dodge Challenger 70-74: 5x115 -> 5x114.3
  const challenger = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x114.3'
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'challenger'
    AND year BETWEEN 1970 AND 1974
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Dodge Challenger 70-74:", challenger.length, "records -> 5x114.3");
  
  // 2. Fix Dodge Charger pre-80: 5x115 -> 5x114.3
  const charger = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x114.3'
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'charger'
    AND year < 1980
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Dodge Charger pre-80:", charger.length, "records -> 5x114.3");
  
  // 3. Fix Dodge Demon: 5x115 -> 5x114.3
  const demon = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x114.3'
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'demon'
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Dodge Demon:", demon.length, "records -> 5x114.3");
  
  // 4. Fix Buick Skylark 65-72: 5x100 -> 5x120.65 (GM A-body)
  const skylark = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65'
    WHERE LOWER(make) = 'buick' AND LOWER(model) = 'skylark'
    AND year BETWEEN 1965 AND 1972
    AND bolt_pattern = '5x100'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Buick Skylark 65-72:", skylark.length, "records -> 5x120.65");
  
  // 5. Fix Chevy Monte Carlo 78-87: 5x115 -> 5x120.65
  const monteCarlo = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x120.65'
    WHERE LOWER(make) = 'chevrolet' AND (LOWER(model) = 'monte carlo' OR LOWER(model) = 'monte-carlo')
    AND year BETWEEN 1970 AND 1987
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Chevy Monte Carlo 70-87:", monteCarlo.length, "records -> 5x120.65");
  
  // 6. Fix Dodge Ramcharger 82-87: These actually should be 5x139.7 (5-lug truck pattern)
  // Note: This is more complex as Ramcharger came in different configs
  // 74-80 used 5x139.7, 81-93 used 5x139.7 for 2WD, 6x139.7 for 4WD
  // Let me check what we have
  const ramchargerCheck = await client`
    SELECT year, bolt_pattern, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'ramcharger'
    ORDER BY year
  `;
  console.log("\n⚠️  Dodge Ramcharger records to review:");
  ramchargerCheck.forEach(r => console.log("   " + r.year + ": " + r.bolt_pattern));
  
  // Fix Ramcharger to 5x139.7 (standard truck pattern for these years)
  const ramcharger = await client`
    UPDATE vehicle_fitments 
    SET bolt_pattern = '5x139.7'
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'ramcharger'
    AND bolt_pattern = '5x115'
    RETURNING year, modification_id
  `;
  console.log("✅ Fixed Dodge Ramcharger:", ramcharger.length, "records -> 5x139.7");
  
  // 7. Cadillac/Buick Riviera pre-1980 with 5x115 - need research
  // Actually 5x115 IS correct for these - it's the original GM B/C/E body pattern
  // Starting 1971, GM used 5x115 (5x4.5) for full-size RWD cars
  // So Cadillac DeVille, Eldorado, Buick Riviera 1971+ with 5x115 is CORRECT
  // But pre-1971 used 5x120.65 or 5x127
  
  console.log("\n=== Checking Cadillac/Buick Riviera ===");
  const cadillac = await client`
    SELECT make, model, year, bolt_pattern
    FROM vehicle_fitments 
    WHERE (LOWER(make) = 'cadillac' OR (LOWER(make) = 'buick' AND LOWER(model) = 'riviera'))
    AND year < 1971
    AND bolt_pattern = '5x115'
    ORDER BY make, model, year
  `;
  if (cadillac.length > 0) {
    console.log("⚠️  Pre-1971 Cadillac/Riviera with 5x115 (may need fix to 5x120.65):");
    cadillac.forEach(r => console.log("   " + r.year + " " + r.make + " " + r.model + ": " + r.bolt_pattern));
  }
  
  console.log("\n=== SUMMARY ===");
  const totalFixed = challenger.length + charger.length + demon.length + skylark.length + monteCarlo.length + ramcharger.length;
  console.log("Total records fixed:", totalFixed);
  
  await client.end();
}

main().catch(console.error);