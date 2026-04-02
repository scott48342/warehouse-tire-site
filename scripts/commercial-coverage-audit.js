/**
 * Commercial Coverage Audit
 * 
 * Analyzes fitment coverage against real-world vehicle popularity.
 * Focus: Revenue impact, not theoretical completeness.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// ═══════════════════════════════════════════════════════════════════════════
// HIGH-VOLUME US VEHICLES (based on sales rankings)
// Priority: 1 = Top sellers, 2 = Popular, 3 = Common, 4 = Niche
// ═══════════════════════════════════════════════════════════════════════════

const HIGH_VOLUME_VEHICLES = [
  // TRUCKS (Highest volume category)
  { make: 'ford', model: 'f-150', priority: 1, category: 'truck', years: [2000, 2026] },
  { make: 'chevrolet', model: 'silverado-1500', priority: 1, category: 'truck', years: [2000, 2026] },
  { make: 'ram', model: '1500', priority: 1, category: 'truck', years: [2000, 2026] },
  { make: 'toyota', model: 'tacoma', priority: 1, category: 'truck', years: [2000, 2026] },
  { make: 'toyota', model: 'tundra', priority: 2, category: 'truck', years: [2000, 2026] },
  { make: 'nissan', model: 'frontier', priority: 2, category: 'truck', years: [2000, 2026] },
  { make: 'gmc', model: 'sierra-1500', priority: 2, category: 'truck', years: [2000, 2026] },
  { make: 'chevrolet', model: 'colorado', priority: 2, category: 'truck', years: [2004, 2026] },
  { make: 'ford', model: 'ranger', priority: 2, category: 'truck', years: [2000, 2012], years2: [2019, 2026] },
  { make: 'honda', model: 'ridgeline', priority: 3, category: 'truck', years: [2006, 2026] },

  // SUVS - Compact/Crossover (Massive volume)
  { make: 'toyota', model: 'rav4', priority: 1, category: 'suv-compact', years: [2000, 2026] },
  { make: 'honda', model: 'cr-v', priority: 1, category: 'suv-compact', years: [2000, 2026] },
  { make: 'nissan', model: 'rogue', priority: 1, category: 'suv-compact', years: [2008, 2026] },
  { make: 'chevrolet', model: 'equinox', priority: 1, category: 'suv-compact', years: [2005, 2026] },
  { make: 'ford', model: 'escape', priority: 1, category: 'suv-compact', years: [2000, 2026] },
  { make: 'jeep', model: 'grand-cherokee', priority: 1, category: 'suv-mid', years: [2000, 2026] },
  { make: 'jeep', model: 'wrangler', priority: 1, category: 'suv-mid', years: [2000, 2026] },
  { make: 'toyota', model: 'highlander', priority: 1, category: 'suv-mid', years: [2001, 2026] },
  { make: 'honda', model: 'pilot', priority: 2, category: 'suv-mid', years: [2003, 2026] },
  { make: 'ford', model: 'explorer', priority: 1, category: 'suv-mid', years: [2000, 2026] },
  { make: 'subaru', model: 'outback', priority: 2, category: 'suv-compact', years: [2000, 2026] },
  { make: 'subaru', model: 'forester', priority: 2, category: 'suv-compact', years: [2000, 2026] },
  { make: 'mazda', model: 'cx-5', priority: 2, category: 'suv-compact', years: [2013, 2026] },
  { make: 'hyundai', model: 'tucson', priority: 2, category: 'suv-compact', years: [2005, 2026] },
  { make: 'hyundai', model: 'santa-fe', priority: 2, category: 'suv-mid', years: [2001, 2026] },
  { make: 'kia', model: 'sportage', priority: 2, category: 'suv-compact', years: [2000, 2026] },
  { make: 'kia', model: 'sorento', priority: 2, category: 'suv-mid', years: [2003, 2026] },
  { make: 'gmc', model: 'terrain', priority: 2, category: 'suv-compact', years: [2010, 2026] },
  { make: 'jeep', model: 'cherokee', priority: 2, category: 'suv-compact', years: [2000, 2026] },
  { make: 'volkswagen', model: 'tiguan', priority: 2, category: 'suv-compact', years: [2009, 2026] },
  { make: 'nissan', model: 'murano', priority: 2, category: 'suv-mid', years: [2003, 2026] },
  { make: 'nissan', model: 'pathfinder', priority: 2, category: 'suv-mid', years: [2000, 2026] },
  { make: 'chevrolet', model: 'traverse', priority: 2, category: 'suv-full', years: [2009, 2026] },
  { make: 'chevrolet', model: 'tahoe', priority: 2, category: 'suv-full', years: [2000, 2026] },
  { make: 'chevrolet', model: 'suburban', priority: 2, category: 'suv-full', years: [2000, 2026] },
  { make: 'ford', model: 'expedition', priority: 2, category: 'suv-full', years: [2000, 2026] },
  { make: 'toyota', model: '4runner', priority: 2, category: 'suv-mid', years: [2000, 2026] },
  { make: 'gmc', model: 'yukon', priority: 3, category: 'suv-full', years: [2000, 2026] },
  { make: 'gmc', model: 'acadia', priority: 2, category: 'suv-mid', years: [2007, 2026] },
  { make: 'buick', model: 'enclave', priority: 3, category: 'suv-mid', years: [2008, 2026] },
  { make: 'dodge', model: 'durango', priority: 2, category: 'suv-mid', years: [2000, 2026] },
  { make: 'lexus', model: 'rx', priority: 2, category: 'suv-luxury', years: [2000, 2026] },
  { make: 'bmw', model: 'x3', priority: 2, category: 'suv-luxury', years: [2004, 2026] },
  { make: 'bmw', model: 'x5', priority: 2, category: 'suv-luxury', years: [2000, 2026] },
  { make: 'audi', model: 'q5', priority: 2, category: 'suv-luxury', years: [2009, 2026] },
  { make: 'mercedes', model: 'gle', priority: 2, category: 'suv-luxury', years: [2006, 2026] },

  // SEDANS (Still significant volume)
  { make: 'toyota', model: 'camry', priority: 1, category: 'sedan-mid', years: [2000, 2026] },
  { make: 'honda', model: 'civic', priority: 1, category: 'sedan-compact', years: [2000, 2026] },
  { make: 'honda', model: 'accord', priority: 1, category: 'sedan-mid', years: [2000, 2026] },
  { make: 'toyota', model: 'corolla', priority: 1, category: 'sedan-compact', years: [2000, 2026] },
  { make: 'nissan', model: 'altima', priority: 1, category: 'sedan-mid', years: [2000, 2026] },
  { make: 'nissan', model: 'sentra', priority: 2, category: 'sedan-compact', years: [2000, 2026] },
  { make: 'hyundai', model: 'elantra', priority: 2, category: 'sedan-compact', years: [2000, 2026] },
  { make: 'hyundai', model: 'sonata', priority: 2, category: 'sedan-mid', years: [2000, 2026] },
  { make: 'kia', model: 'forte', priority: 2, category: 'sedan-compact', years: [2010, 2026] },
  { make: 'kia', model: 'optima', priority: 2, category: 'sedan-mid', years: [2001, 2020] },
  { make: 'kia', model: 'k5', priority: 2, category: 'sedan-mid', years: [2021, 2026] },
  { make: 'mazda', model: 'mazda3', priority: 2, category: 'sedan-compact', years: [2004, 2026] },
  { make: 'mazda', model: 'mazda6', priority: 2, category: 'sedan-mid', years: [2003, 2021] },
  { make: 'chevrolet', model: 'malibu', priority: 2, category: 'sedan-mid', years: [2000, 2026] },
  { make: 'ford', model: 'fusion', priority: 2, category: 'sedan-mid', years: [2006, 2020] },
  { make: 'ford', model: 'focus', priority: 2, category: 'sedan-compact', years: [2000, 2018] },
  { make: 'volkswagen', model: 'jetta', priority: 2, category: 'sedan-compact', years: [2000, 2026] },
  { make: 'volkswagen', model: 'passat', priority: 2, category: 'sedan-mid', years: [2000, 2022] },
  { make: 'subaru', model: 'impreza', priority: 2, category: 'sedan-compact', years: [2000, 2026] },
  { make: 'subaru', model: 'legacy', priority: 3, category: 'sedan-mid', years: [2000, 2026] },
  { make: 'nissan', model: 'maxima', priority: 3, category: 'sedan-full', years: [2000, 2026] },
  { make: 'toyota', model: 'avalon', priority: 3, category: 'sedan-full', years: [2000, 2022] },
  { make: 'chevrolet', model: 'impala', priority: 3, category: 'sedan-full', years: [2000, 2020] },
  { make: 'chrysler', model: '300', priority: 2, category: 'sedan-full', years: [2005, 2026] },
  { make: 'dodge', model: 'charger', priority: 1, category: 'sedan-muscle', years: [2006, 2026] },

  // MINIVANS
  { make: 'honda', model: 'odyssey', priority: 2, category: 'minivan', years: [2000, 2026] },
  { make: 'toyota', model: 'sienna', priority: 2, category: 'minivan', years: [2000, 2026] },
  { make: 'chrysler', model: 'pacifica', priority: 2, category: 'minivan', years: [2017, 2026] },
  { make: 'chrysler', model: 'town-and-country', priority: 3, category: 'minivan', years: [2000, 2016] },
  { make: 'dodge', model: 'grand-caravan', priority: 2, category: 'minivan', years: [2000, 2020] },
  { make: 'kia', model: 'carnival', priority: 3, category: 'minivan', years: [2022, 2026] },
  { make: 'kia', model: 'sedona', priority: 3, category: 'minivan', years: [2002, 2021] },

  // SPORTS/PERFORMANCE (High engagement)
  { make: 'ford', model: 'mustang', priority: 1, category: 'sports', years: [2000, 2026] },
  { make: 'chevrolet', model: 'camaro', priority: 1, category: 'sports', years: [2000, 2026] },
  { make: 'dodge', model: 'challenger', priority: 1, category: 'sports', years: [2008, 2024] },
  { make: 'chevrolet', model: 'corvette', priority: 1, category: 'sports', years: [2000, 2026] },
  { make: 'nissan', model: '370z', priority: 2, category: 'sports', years: [2009, 2020] },
  { make: 'nissan', model: 'z', priority: 2, category: 'sports', years: [2023, 2026] },
  { make: 'toyota', model: 'supra', priority: 2, category: 'sports', years: [2020, 2026] },
  { make: 'subaru', model: 'brz', priority: 2, category: 'sports', years: [2013, 2026] },
  { make: 'toyota', model: 'gr86', priority: 2, category: 'sports', years: [2022, 2026] },
  { make: 'mazda', model: 'mx-5-miata', priority: 2, category: 'sports', years: [2000, 2026] },

  // ELECTRIC (Growing fast)
  { make: 'tesla', model: 'model-3', priority: 1, category: 'electric', years: [2017, 2026] },
  { make: 'tesla', model: 'model-y', priority: 1, category: 'electric', years: [2020, 2026] },
  { make: 'tesla', model: 'model-s', priority: 2, category: 'electric', years: [2012, 2026] },
  { make: 'tesla', model: 'model-x', priority: 2, category: 'electric', years: [2016, 2026] },
  { make: 'chevrolet', model: 'bolt-ev', priority: 2, category: 'electric', years: [2017, 2023] },
  { make: 'ford', model: 'mustang-mach-e', priority: 2, category: 'electric', years: [2021, 2026] },
  { make: 'hyundai', model: 'ioniq-5', priority: 2, category: 'electric', years: [2022, 2026] },
  { make: 'kia', model: 'ev6', priority: 2, category: 'electric', years: [2022, 2026] },
  { make: 'ford', model: 'f-150-lightning', priority: 2, category: 'electric', years: [2022, 2026] },
  { make: 'rivian', model: 'r1t', priority: 3, category: 'electric', years: [2022, 2026] },
  { make: 'rivian', model: 'r1s', priority: 3, category: 'electric', years: [2022, 2026] },

  // COMPACT/ECONOMY
  { make: 'toyota', model: 'prius', priority: 2, category: 'hybrid', years: [2000, 2026] },
  { make: 'honda', model: 'fit', priority: 3, category: 'subcompact', years: [2007, 2020] },
  { make: 'toyota', model: 'yaris', priority: 3, category: 'subcompact', years: [2000, 2020] },
  { make: 'nissan', model: 'versa', priority: 3, category: 'subcompact', years: [2007, 2026] },
  { make: 'hyundai', model: 'accent', priority: 3, category: 'subcompact', years: [2000, 2022] },
  { make: 'kia', model: 'rio', priority: 3, category: 'subcompact', years: [2001, 2026] },
  { make: 'chevrolet', model: 'spark', priority: 4, category: 'subcompact', years: [2013, 2022] },
  { make: 'mitsubishi', model: 'mirage', priority: 4, category: 'subcompact', years: [2014, 2026] },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  console.log('═'.repeat(80));
  console.log('COMMERCIAL COVERAGE AUDIT');
  console.log('═'.repeat(80));
  console.log('Focus: Revenue impact, not theoretical completeness\n');

  // Get all our current coverage (2000+)
  const coverage = await pool.query(`
    SELECT DISTINCT year, make, model 
    FROM vehicle_fitments 
    WHERE year >= 2000 
    ORDER BY make, model, year
  `);

  // Build coverage set for fast lookup
  const coverageSet = new Set();
  for (const row of coverage.rows) {
    coverageSet.add(`${row.year}|${row.make}|${row.model}`);
  }

  console.log(`Current coverage: ${coverage.rows.length} Y/M/M combinations (2000-2026)\n`);

  // Analyze each high-volume vehicle
  const results = {
    covered: [],
    missing: [],
    byPriority: { 1: [], 2: [], 3: [], 4: [] },
    byCategory: {},
    byMake: {},
  };

  for (const vehicle of HIGH_VOLUME_VEHICLES) {
    const yearStart = vehicle.years[0];
    const yearEnd = vehicle.years[1];
    
    let coveredYears = [];
    let missingYears = [];
    
    for (let year = yearStart; year <= yearEnd; year++) {
      // Skip years in gap (e.g., Ranger 2012-2018)
      if (vehicle.years2 && year > vehicle.years[1] && year < vehicle.years2[0]) {
        continue;
      }
      if (vehicle.years2 && year >= vehicle.years2[0]) {
        // In second range
      }
      
      const key = `${year}|${vehicle.make}|${vehicle.model}`;
      // Also check common variations
      const keyAlt = `${year}|${vehicle.make}|${vehicle.model.replace(/-/g, '')}`;
      
      if (coverageSet.has(key) || coverageSet.has(keyAlt)) {
        coveredYears.push(year);
      } else {
        missingYears.push(year);
      }
    }

    const totalYears = coveredYears.length + missingYears.length;
    const coveragePct = totalYears > 0 ? (coveredYears.length / totalYears * 100).toFixed(0) : 0;

    const entry = {
      make: vehicle.make,
      model: vehicle.model,
      priority: vehicle.priority,
      category: vehicle.category,
      totalYears,
      coveredYears: coveredYears.length,
      missingYears: missingYears.length,
      coveragePct: parseInt(coveragePct),
      missingList: missingYears,
    };

    if (missingYears.length > 0) {
      results.missing.push(entry);
      results.byPriority[vehicle.priority].push(entry);
    } else {
      results.covered.push(entry);
    }

    // Track by category
    if (!results.byCategory[vehicle.category]) {
      results.byCategory[vehicle.category] = { covered: 0, missing: 0, vehicles: [] };
    }
    if (missingYears.length > 0) {
      results.byCategory[vehicle.category].missing++;
      results.byCategory[vehicle.category].vehicles.push(entry);
    } else {
      results.byCategory[vehicle.category].covered++;
    }

    // Track by make
    if (!results.byMake[vehicle.make]) {
      results.byMake[vehicle.make] = { covered: 0, missing: 0 };
    }
    if (missingYears.length > 0) {
      results.byMake[vehicle.make].missing++;
    } else {
      results.byMake[vehicle.make].covered++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('─'.repeat(80));
  console.log('COVERAGE SUMMARY');
  console.log('─'.repeat(80));
  
  const totalVehicles = HIGH_VOLUME_VEHICLES.length;
  const coveredVehicles = results.covered.length;
  const missingVehicles = results.missing.length;
  
  console.log(`\nHigh-Volume Vehicles Analyzed: ${totalVehicles}`);
  console.log(`  ✅ Fully Covered: ${coveredVehicles} (${(coveredVehicles/totalVehicles*100).toFixed(0)}%)`);
  console.log(`  ❌ Missing/Partial: ${missingVehicles} (${(missingVehicles/totalVehicles*100).toFixed(0)}%)`);

  // ─────────────────────────────────────────────────────────────────────────
  // BY PRIORITY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('MISSING BY PRIORITY');
  console.log('─'.repeat(80));

  for (const priority of [1, 2, 3, 4]) {
    const label = priority === 1 ? '🔴 CRITICAL (Top Sellers)' :
                  priority === 2 ? '🟠 HIGH (Popular)' :
                  priority === 3 ? '🟡 MEDIUM (Common)' : '⚪ LOW (Niche)';
    
    console.log(`\n${label}: ${results.byPriority[priority].length} vehicles`);
    
    for (const v of results.byPriority[priority].slice(0, 15)) {
      const yearRange = v.missingList.length > 3 
        ? `${Math.min(...v.missingList)}-${Math.max(...v.missingList)}`
        : v.missingList.join(', ');
      console.log(`  • ${v.make}/${v.model}: ${v.coveragePct}% covered, missing ${v.missingYears} years (${yearRange})`);
    }
    if (results.byPriority[priority].length > 15) {
      console.log(`  ... and ${results.byPriority[priority].length - 15} more`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BY CATEGORY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('COVERAGE BY CATEGORY');
  console.log('─'.repeat(80));

  const categories = Object.entries(results.byCategory).sort((a, b) => b[1].missing - a[1].missing);
  for (const [cat, data] of categories) {
    const total = data.covered + data.missing;
    const pct = (data.covered / total * 100).toFixed(0);
    const status = data.missing === 0 ? '✅' : data.missing > data.covered ? '❌' : '⚠️';
    console.log(`${status} ${cat}: ${data.covered}/${total} covered (${pct}%)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BY MAKE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('COVERAGE BY MAKE (Major Brands)');
  console.log('─'.repeat(80));

  const makes = Object.entries(results.byMake).sort((a, b) => b[1].missing - a[1].missing);
  for (const [make, data] of makes) {
    const total = data.covered + data.missing;
    const pct = (data.covered / total * 100).toFixed(0);
    const status = data.missing === 0 ? '✅' : data.missing > 2 ? '❌' : '⚠️';
    console.log(`${status} ${make}: ${data.covered}/${total} models covered (${pct}%)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOP 50 VEHICLES TO ADD
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  console.log('🎯 RECOMMENDED NEXT 50 VEHICLES TO ADD');
  console.log('─'.repeat(80));

  // Sort by priority, then by missing years
  const sortedMissing = results.missing
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.missingYears - a.missingYears;
    })
    .slice(0, 50);

  let rank = 1;
  for (const v of sortedMissing) {
    const yearRange = v.missingList.length > 5 
      ? `${Math.min(...v.missingList)}-${Math.max(...v.missingList)}`
      : v.missingList.join(', ');
    const priorityIcon = v.priority === 1 ? '🔴' : v.priority === 2 ? '🟠' : '🟡';
    console.log(`${rank.toString().padStart(2)}. ${priorityIcon} ${v.make}/${v.model} [${v.category}]`);
    console.log(`    Missing ${v.missingYears} years: ${yearRange}`);
    rank++;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ESTIMATED REAL-WORLD COVERAGE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('📊 ESTIMATED REAL-WORLD COVERAGE');
  console.log('═'.repeat(80));

  // Weight by priority (priority 1 = 40% of traffic, 2 = 35%, 3 = 20%, 4 = 5%)
  const weights = { 1: 0.40, 2: 0.35, 3: 0.20, 4: 0.05 };
  let weightedCoverage = 0;
  let totalWeight = 0;

  for (const priority of [1, 2, 3, 4]) {
    const priorityVehicles = HIGH_VOLUME_VEHICLES.filter(v => v.priority === priority);
    const priorityCovered = priorityVehicles.filter(v => !results.byPriority[priority].find(m => m.make === v.make && m.model === v.model));
    
    const pct = priorityVehicles.length > 0 ? priorityCovered.length / priorityVehicles.length : 0;
    weightedCoverage += pct * weights[priority];
    totalWeight += weights[priority];
  }

  const estimatedCoverage = (weightedCoverage / totalWeight * 100).toFixed(1);
  
  console.log(`\nEstimated Real-World Coverage: ${estimatedCoverage}%`);
  console.log(`(Weighted by traffic: P1=40%, P2=35%, P3=20%, P4=5%)\n`);

  if (estimatedCoverage >= 90) {
    console.log('✅ EXCELLENT - Covers vast majority of customer searches');
  } else if (estimatedCoverage >= 75) {
    console.log('🟡 GOOD - Solid coverage, priority gaps identified above');
  } else if (estimatedCoverage >= 50) {
    console.log('🟠 NEEDS WORK - Significant gaps in popular vehicles');
  } else {
    console.log('🔴 CRITICAL - Major coverage gaps affecting revenue');
  }

  await pool.end();
}

main().catch(console.error);
