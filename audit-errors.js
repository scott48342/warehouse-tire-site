const postgres = require("postgres");

async function main() {
  const client = postgres(process.env.PG_URL);
  
  // Known correct bolt patterns for classic vehicles:
  // GM A-body (Chevelle, Malibu, El Camino, Monte Carlo 70-87): 5x120.65 (5x4.75)
  // GM F-body (Camaro, Firebird): 5x120.65 (5x4.75) 
  // GM X-body (Nova, Omega, Ventura, Apollo): 5x120.65 (5x4.75)
  // Corvette 53-82: 5x120.65 (5x4.75)
  // Mopar A-body (Dart, Duster, Valiant, Barracuda 64-69): 5x101.6 (5x4.0)
  // Mopar B-body (Charger, Road Runner, GTX, Coronet): 5x114.3 (5x4.5)
  // Mopar E-body (Challenger, Barracuda 70-74): 5x114.3 (5x4.5)
  // Ford Mustang 65-73: 5x114.3 (5x4.5), but 64.5 was 4x108
  // Ford Mustang 74-93: 4x108 (4x4.25)

  // Find vehicles with WRONG bolt patterns
  const errors = [];
  
  // 1. Dodge Challenger 70-74 should be 5x114.3, not 5x115
  const challenger = await client`
    SELECT year, make, model, bolt_pattern, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'challenger'
    AND year BETWEEN 1970 AND 1974
    AND bolt_pattern = '5x115'
  `;
  if (challenger.length > 0) {
    errors.push({ issue: "Dodge Challenger 70-74 has 5x115, should be 5x114.3", count: challenger.length, records: challenger });
  }
  
  // 2. Dodge Charger should be 5x114.3, not 5x115
  const charger = await client`
    SELECT year, make, model, bolt_pattern, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'charger'
    AND year < 1980
    AND bolt_pattern = '5x115'
  `;
  if (charger.length > 0) {
    errors.push({ issue: "Dodge Charger pre-80 has 5x115, should be 5x114.3", count: charger.length, records: charger });
  }
  
  // 3. Dodge Demon should be 5x114.3, not 5x115
  const demon = await client`
    SELECT year, make, model, bolt_pattern, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'demon'
    AND bolt_pattern = '5x115'
  `;
  if (demon.length > 0) {
    errors.push({ issue: "Dodge Demon has 5x115, should be 5x114.3", count: demon.length, records: demon });
  }
  
  // 4. Dodge Ramcharger pre-82 should be 5x139.7 (6-lug), not 5x115
  const ramcharger = await client`
    SELECT year, make, model, bolt_pattern, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'dodge' AND LOWER(model) = 'ramcharger'
    AND bolt_pattern = '5x115'
  `;
  if (ramcharger.length > 0) {
    errors.push({ issue: "Dodge Ramcharger has 5x115, may need verification", count: ramcharger.length, records: ramcharger });
  }
  
  // 5. Buick Skylark 65-72 should be 5x120.65 (GM A-body), not 5x100
  const skylark = await client`
    SELECT year, make, model, bolt_pattern, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'buick' AND LOWER(model) = 'skylark'
    AND year BETWEEN 1965 AND 1972
    AND bolt_pattern = '5x100'
  `;
  if (skylark.length > 0) {
    errors.push({ issue: "Buick Skylark 65-72 has 5x100, should be 5x120.65 (GM A-body)", count: skylark.length, records: skylark });
  }
  
  // 6. Chevy Monte Carlo 70-88 should be 5x120.65, but we have some with 5x115
  const monteCarlo = await client`
    SELECT year, make, model, bolt_pattern, modification_id
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' AND (LOWER(model) = 'monte carlo' OR LOWER(model) = 'monte-carlo')
    AND year < 1988
    AND bolt_pattern = '5x115'
  `;
  if (monteCarlo.length > 0) {
    errors.push({ issue: "Chevy Monte Carlo pre-88 has 5x115, should be 5x120.65", count: monteCarlo.length, records: monteCarlo });
  }
  
  // 7. Check any 5x115 that seems wrong for pre-1980 vehicles (5x115 is modern Chrysler/GM FWD)
  const suspicious115 = await client`
    SELECT DISTINCT make, model, bolt_pattern, MIN(year) as min_year, MAX(year) as max_year, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE bolt_pattern = '5x115'
    AND year < 1980
    GROUP BY make, model, bolt_pattern
    ORDER BY make, model
  `;
  if (suspicious115.length > 0) {
    errors.push({ issue: "Pre-1980 vehicles with 5x115 (suspicious - 5x115 is modern pattern)", count: suspicious115.length, records: suspicious115 });
  }

  console.log("=== BOLT PATTERN AUDIT RESULTS ===\n");
  
  if (errors.length === 0) {
    console.log("No obvious errors found!");
  } else {
    errors.forEach(e => {
      console.log(`\n❌ ${e.issue}`);
      console.log(`   Affected: ${e.count} records`);
      if (e.records.length <= 10) {
        e.records.forEach(r => {
          console.log(`   - ${r.year || r.min_year + '-' + r.max_year} ${r.make} ${r.model}: ${r.bolt_pattern}`);
        });
      }
    });
  }
  
  await client.end();
}

main().catch(console.error);