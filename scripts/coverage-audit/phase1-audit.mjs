/**
 * Phase 1: Full Coverage Audit
 * 
 * Generates:
 * 1. Coverage summary (total target vs covered)
 * 2. Missing vehicles report
 * 3. Potential data errors report
 * 
 * @created 2026-06-12
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';
const OUTPUT_DIR = './scripts/coverage-audit/reports';

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET VEHICLE UNIVERSE
// ═══════════════════════════════════════════════════════════════════════════════

const TIER_1_VEHICLES = [
  // Full-size trucks
  { make: "Ford", model: "F-150" },
  { make: "Chevrolet", model: "Silverado 1500" },
  { make: "RAM", model: "Ram 1500" },
  { make: "GMC", model: "Sierra 1500" },
  { make: "Toyota", model: "Tundra" },
  { make: "Nissan", model: "Titan" },
  // Mid-size trucks
  { make: "Toyota", model: "Tacoma" },
  { make: "Ford", model: "Ranger" },
  { make: "Chevrolet", model: "Colorado" },
  { make: "GMC", model: "Canyon" },
  { make: "Nissan", model: "Frontier" },
  { make: "Honda", model: "Ridgeline" },
  { make: "Jeep", model: "Gladiator" },
  { make: "Ford", model: "Maverick" },
  // Heavy-duty trucks
  { make: "Ford", model: "F-250" },
  { make: "Ford", model: "F-350" },
  { make: "Chevrolet", model: "Silverado 2500 HD" },
  { make: "Chevrolet", model: "Silverado 3500 HD" },
  { make: "RAM", model: "Ram 2500" },
  { make: "RAM", model: "Ram 3500" },
  { make: "GMC", model: "Sierra 2500 HD" },
  { make: "GMC", model: "Sierra 3500 HD" },
  // Top compact SUVs
  { make: "Toyota", model: "RAV4" },
  { make: "Honda", model: "CR-V" },
  { make: "Mazda", model: "CX-5" },
  { make: "Subaru", model: "Crosstrek" },
  { make: "Subaru", model: "Forester" },
  { make: "Hyundai", model: "Tucson" },
  { make: "Kia", model: "Sportage" },
  { make: "Nissan", model: "Rogue" },
  { make: "Ford", model: "Escape" },
  { make: "Chevrolet", model: "Equinox" },
  // Top mid-size SUVs
  { make: "Toyota", model: "Highlander" },
  { make: "Honda", model: "Pilot" },
  { make: "Ford", model: "Explorer" },
  { make: "Chevrolet", model: "Traverse" },
  { make: "Hyundai", model: "Santa Fe" },
  { make: "Kia", model: "Sorento" },
  { make: "Subaru", model: "Outback" },
  { make: "Mazda", model: "CX-9" },
  // Top full-size SUVs
  { make: "Chevrolet", model: "Tahoe" },
  { make: "Chevrolet", model: "Suburban" },
  { make: "GMC", model: "Yukon" },
  { make: "GMC", model: "Yukon XL" },
  { make: "Ford", model: "Expedition" },
  { make: "Toyota", model: "Sequoia" },
  { make: "Nissan", model: "Armada" },
  // Iconic off-road
  { make: "Jeep", model: "Wrangler" },
  { make: "Jeep", model: "Grand Cherokee" },
  { make: "Toyota", model: "4Runner" },
  { make: "Ford", model: "Bronco" },
  { make: "Land Rover", model: "Defender" },
];

const TIER_2_VEHICLES = [
  // Additional SUVs
  { make: "Jeep", model: "Cherokee" },
  { make: "Jeep", model: "Compass" },
  { make: "Jeep", model: "Renegade" },
  { make: "Ford", model: "Bronco Sport" },
  { make: "Ford", model: "Edge" },
  { make: "Chevrolet", model: "Blazer" },
  { make: "Chevrolet", model: "Trailblazer" },
  { make: "Chevrolet", model: "Trax" },
  { make: "Honda", model: "Passport" },
  { make: "Honda", model: "HR-V" },
  { make: "Toyota", model: "Venza" },
  { make: "Nissan", model: "Pathfinder" },
  { make: "Nissan", model: "Murano" },
  { make: "Nissan", model: "Kicks" },
  { make: "Subaru", model: "Ascent" },
  { make: "Mazda", model: "CX-30" },
  { make: "Mazda", model: "CX-50" },
  { make: "Kia", model: "Telluride" },
  { make: "Kia", model: "Seltos" },
  { make: "Hyundai", model: "Palisade" },
  { make: "Hyundai", model: "Kona" },
  { make: "Volkswagen", model: "Atlas" },
  { make: "Volkswagen", model: "Tiguan" },
  { make: "Volkswagen", model: "Taos" },
  { make: "GMC", model: "Acadia" },
  { make: "GMC", model: "Terrain" },
  { make: "Buick", model: "Enclave" },
  { make: "Buick", model: "Envision" },
  { make: "Dodge", model: "Durango" },
  // Top sedans
  { make: "Toyota", model: "Camry" },
  { make: "Honda", model: "Civic" },
  { make: "Honda", model: "Accord" },
  { make: "Toyota", model: "Corolla" },
  { make: "Nissan", model: "Altima" },
  { make: "Nissan", model: "Sentra" },
  { make: "Hyundai", model: "Elantra" },
  { make: "Hyundai", model: "Sonata" },
  { make: "Kia", model: "Forte" },
  { make: "Kia", model: "K5" },
  { make: "Mazda", model: "Mazda3" },
  { make: "Mazda", model: "Mazda6" },
  { make: "Subaru", model: "Impreza" },
  { make: "Subaru", model: "Legacy" },
  { make: "Volkswagen", model: "Jetta" },
  { make: "Volkswagen", model: "Passat" },
  { make: "Chevrolet", model: "Malibu" },
  // EVs
  { make: "Tesla", model: "Model Y" },
  { make: "Tesla", model: "Model 3" },
  { make: "Tesla", model: "Model X" },
  { make: "Tesla", model: "Model S" },
  { make: "Ford", model: "Mustang Mach-E" },
  { make: "Chevrolet", model: "Bolt EV" },
  { make: "Chevrolet", model: "Bolt EUV" },
  { make: "Hyundai", model: "Ioniq 5" },
  { make: "Hyundai", model: "Ioniq 6" },
  { make: "Kia", model: "EV6" },
  { make: "Volkswagen", model: "ID.4" },
  { make: "Rivian", model: "R1T" },
  { make: "Rivian", model: "R1S" },
  { make: "Tesla", model: "Cybertruck" },
  // Sports/Performance
  { make: "Ford", model: "Mustang" },
  { make: "Chevrolet", model: "Camaro" },
  { make: "Chevrolet", model: "Corvette" },
  { make: "Dodge", model: "Challenger" },
  { make: "Dodge", model: "Charger" },
  { make: "Subaru", model: "WRX" },
  // Minivans
  { make: "Toyota", model: "Sienna" },
  { make: "Honda", model: "Odyssey" },
  { make: "Chrysler", model: "Pacifica" },
  { make: "Kia", model: "Carnival" },
  // Luxury SUVs
  { make: "Lexus", model: "RX" },
  { make: "Lexus", model: "NX" },
  { make: "Lexus", model: "GX" },
  { make: "Acura", model: "MDX" },
  { make: "Acura", model: "RDX" },
  { make: "BMW", model: "X3" },
  { make: "BMW", model: "X5" },
  { make: "Mercedes-Benz", model: "GLE" },
  { make: "Mercedes-Benz", model: "GLC" },
  { make: "Audi", model: "Q5" },
  { make: "Audi", model: "Q7" },
  { make: "Volvo", model: "XC90" },
  { make: "Volvo", model: "XC60" },
  { make: "Cadillac", model: "Escalade" },
  { make: "Lincoln", model: "Navigator" },
  { make: "Lincoln", model: "Aviator" },
  { make: "Porsche", model: "Cayenne" },
  { make: "Porsche", model: "Macan" },
  { make: "Land Rover", model: "Range Rover" },
  { make: "Land Rover", model: "Range Rover Sport" },
  { make: "Genesis", model: "GV80" },
  { make: "Genesis", model: "GV70" },
  { make: "Infiniti", model: "QX60" },
  { make: "Infiniti", model: "QX80" },
];

const TIER_3_VEHICLES = [
  // Luxury sedans
  { make: "BMW", model: "3 Series" },
  { make: "BMW", model: "5 Series" },
  { make: "Mercedes-Benz", model: "C-Class" },
  { make: "Mercedes-Benz", model: "E-Class" },
  { make: "Audi", model: "A4" },
  { make: "Audi", model: "A6" },
  { make: "Lexus", model: "ES" },
  { make: "Lexus", model: "IS" },
  { make: "Acura", model: "TLX" },
  { make: "Acura", model: "Integra" },
  { make: "Genesis", model: "G70" },
  { make: "Genesis", model: "G80" },
  { make: "Infiniti", model: "Q50" },
  { make: "Volvo", model: "S60" },
  { make: "Cadillac", model: "CT5" },
  // Additional SUVs
  { make: "BMW", model: "X1" },
  { make: "BMW", model: "X7" },
  { make: "Mercedes-Benz", model: "GLA" },
  { make: "Mercedes-Benz", model: "GLB" },
  { make: "Mercedes-Benz", model: "GLS" },
  { make: "Audi", model: "Q3" },
  { make: "Audi", model: "Q8" },
  { make: "Lexus", model: "UX" },
  { make: "Lexus", model: "LX" },
  { make: "Volvo", model: "XC40" },
  { make: "Cadillac", model: "XT4" },
  { make: "Cadillac", model: "XT5" },
  { make: "Cadillac", model: "XT6" },
  { make: "Lincoln", model: "Corsair" },
  { make: "Lincoln", model: "Nautilus" },
  // Wagoneer
  { make: "Jeep", model: "Wagoneer" },
  { make: "Jeep", model: "Grand Wagoneer" },
  // Compact/specialty
  { make: "Toyota", model: "Prius" },
  { make: "Hyundai", model: "Venue" },
  { make: "Kia", model: "Soul" },
  { make: "Kia", model: "Niro" },
  { make: "Nissan", model: "Versa" },
  { make: "Nissan", model: "Leaf" },
  { make: "Dodge", model: "Journey" },
  // Sports
  { make: "Toyota", model: "GR86" },
  { make: "Subaru", model: "BRZ" },
  { make: "Mazda", model: "MX-5 Miata" },
  { make: "Porsche", model: "911" },
  { make: "Nissan", model: "Z" },
  { make: "Kia", model: "Stinger" },
  { make: "Toyota", model: "Supra" },
  // Pickup
  { make: "Hyundai", model: "Santa Cruz" },
  // Land Rover
  { make: "Land Rover", model: "Discovery" },
  { make: "Land Rover", model: "Discovery Sport" },
  // Alfa Romeo
  { make: "Alfa Romeo", model: "Giulia" },
  { make: "Alfa Romeo", model: "Stelvio" },
  // MINI
  { make: "MINI", model: "Cooper" },
  { make: "MINI", model: "Countryman" },
  // GMC EV
  { make: "GMC", model: "Hummer EV" },
  // Cadillac EV
  { make: "Cadillac", model: "Lyriq" },
  // Vans (added today)
  { make: "Chevrolet", model: "Express 2500" },
  { make: "Chevrolet", model: "Express 3500" },
  { make: "GMC", model: "Savana 2500" },
  { make: "GMC", model: "Savana 3500" },
  { make: "Ford", model: "Transit" },
  { make: "Ford", model: "E-Series" },
  { make: "RAM", model: "ProMaster" },
  { make: "Mercedes-Benz", model: "Sprinter" },
];

const TARGET_YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];

// Known bolt patterns for validation
const KNOWN_FITMENTS = {
  // GM trucks 1999-current
  'Chevrolet:Silverado 1500': { bolt: '6x139.7', cb: 78.1 },
  'GMC:Sierra 1500': { bolt: '6x139.7', cb: 78.1 },
  'Chevrolet:Tahoe': { bolt: '6x139.7', cb: 78.1 },
  'Chevrolet:Suburban': { bolt: '6x139.7', cb: 78.1 },
  'GMC:Yukon': { bolt: '6x139.7', cb: 78.1 },
  'GMC:Yukon XL': { bolt: '6x139.7', cb: 78.1 },
  // Ford trucks
  'Ford:F-150': { bolt: '6x135', cb: 87.1 },
  'Ford:Expedition': { bolt: '6x135', cb: 87.1 },
  // RAM trucks
  'RAM:Ram 1500': { bolt: '5x139.7', cb: 77.8 }, // 2019+ is 6x139.7
  // Toyota trucks
  'Toyota:Tundra': { bolt: '5x150', cb: 110.1 },
  'Toyota:Tacoma': { bolt: '6x139.7', cb: 106.1 },
  'Toyota:4Runner': { bolt: '6x139.7', cb: 106.1 },
  // Nissan trucks
  'Nissan:Titan': { bolt: '6x139.7', cb: 78.1 },
  'Nissan:Frontier': { bolt: '6x114.3', cb: 66.1 },
  // Honda
  'Honda:Civic': { bolt: '5x114.3', cb: 64.1 },
  'Honda:Accord': { bolt: '5x114.3', cb: 64.1 },
  'Honda:CR-V': { bolt: '5x114.3', cb: 64.1 },
  'Honda:Pilot': { bolt: '5x120', cb: 64.1 },
  // Toyota cars
  'Toyota:Camry': { bolt: '5x114.3', cb: 60.1 },
  'Toyota:Corolla': { bolt: '5x114.3', cb: 60.1 },
  'Toyota:RAV4': { bolt: '5x114.3', cb: 60.1 },
  // Jeep
  'Jeep:Wrangler': { bolt: '5x127', cb: 71.5 },
  'Jeep:Grand Cherokee': { bolt: '5x127', cb: 71.6 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchModelsForMakeYear(make, year) {
  try {
    const url = `${BASE_URL}/api/vehicles/models?make=${encodeURIComponent(make)}&year=${year}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error(`Error fetching ${make} ${year}:`, err.message);
    return [];
  }
}

async function fetchTrimsForVehicle(year, make, model) {
  try {
    const url = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    return null;
  }
}

async function fetchFitmentData(year, make, model) {
  try {
    const url = `${BASE_URL}/api/public/fitment/specs?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

function validateFitment(make, model, fitmentData) {
  const key = `${make}:${model}`;
  const known = KNOWN_FITMENTS[key];
  if (!known || !fitmentData) return { valid: true, issues: [] };
  
  const issues = [];
  
  if (fitmentData.boltPattern && fitmentData.boltPattern !== known.bolt) {
    issues.push({
      field: 'boltPattern',
      expected: known.bolt,
      actual: fitmentData.boltPattern,
    });
  }
  
  if (fitmentData.centerBoreMm) {
    const cb = parseFloat(fitmentData.centerBoreMm);
    if (Math.abs(cb - known.cb) > 1) { // Allow 1mm tolerance
      issues.push({
        field: 'centerBore',
        expected: known.cb,
        actual: cb,
      });
    }
  }
  
  return { valid: issues.length === 0, issues };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('WTD VEHICLE COVERAGE AUDIT - Phase 1');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log();

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allVehicles = [
    ...TIER_1_VEHICLES.map(v => ({ ...v, tier: 1 })),
    ...TIER_2_VEHICLES.map(v => ({ ...v, tier: 2 })),
    ...TIER_3_VEHICLES.map(v => ({ ...v, tier: 3 })),
  ];

  const results = {
    summary: {
      totalTarget: 0,
      totalCovered: 0,
      totalMissing: 0,
      coveragePercent: 0,
      byTier: { 1: { target: 0, covered: 0 }, 2: { target: 0, covered: 0 }, 3: { target: 0, covered: 0 } },
      byYear: {},
    },
    covered: [],
    missing: [],
    dataErrors: [],
    timestamp: new Date().toISOString(),
  };

  // Initialize year buckets
  for (const year of TARGET_YEARS) {
    results.summary.byYear[year] = { target: 0, covered: 0 };
  }

  let processed = 0;
  const total = allVehicles.length * TARGET_YEARS.length;

  for (const vehicle of allVehicles) {
    for (const year of TARGET_YEARS) {
      processed++;
      if (processed % 50 === 0) {
        console.log(`Progress: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
      }

      results.summary.totalTarget++;
      results.summary.byTier[vehicle.tier].target++;
      results.summary.byYear[year].target++;

      // Check if model exists for this make/year
      const models = await fetchModelsForMakeYear(vehicle.make, year);
      
      // Normalize model names for comparison
      const normalizedTarget = vehicle.model.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = models.find(m => {
        const normalizedDb = m.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedDb === normalizedTarget || 
               normalizedDb.includes(normalizedTarget) || 
               normalizedTarget.includes(normalizedDb);
      });

      if (found) {
        results.summary.totalCovered++;
        results.summary.byTier[vehicle.tier].covered++;
        results.summary.byYear[year].covered++;
        
        results.covered.push({
          year,
          make: vehicle.make,
          model: vehicle.model,
          dbModel: found,
          tier: vehicle.tier,
        });

        // Validate fitment data
        const fitment = await fetchFitmentData(year, vehicle.make, found);
        if (fitment && fitment.specs) {
          const validation = validateFitment(vehicle.make, vehicle.model, fitment.specs);
          if (!validation.valid) {
            results.dataErrors.push({
              year,
              make: vehicle.make,
              model: vehicle.model,
              tier: vehicle.tier,
              issues: validation.issues,
              currentData: fitment.specs,
            });
          }
        }
      } else {
        results.summary.totalMissing++;
        results.missing.push({
          year,
          make: vehicle.make,
          model: vehicle.model,
          tier: vehicle.tier,
        });
      }

      // Rate limiting - be nice to the server
      await new Promise(r => setTimeout(r, 50));
    }
  }

  results.summary.coveragePercent = Math.round(
    (results.summary.totalCovered / results.summary.totalTarget) * 100
  );

  // Calculate tier percentages
  for (const tier of [1, 2, 3]) {
    results.summary.byTier[tier].percent = Math.round(
      (results.summary.byTier[tier].covered / results.summary.byTier[tier].target) * 100
    );
  }

  // Calculate year percentages
  for (const year of TARGET_YEARS) {
    results.summary.byYear[year].percent = Math.round(
      (results.summary.byYear[year].covered / results.summary.byYear[year].target) * 100
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Full JSON report
  const jsonPath = path.join(OUTPUT_DIR, 'full-audit.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`\nFull report: ${jsonPath}`);

  // Missing vehicles CSV
  const missingCsv = [
    'Tier,Make,Model,Year',
    ...results.missing.map(v => `${v.tier},${v.make},${v.model},${v.year}`)
  ].join('\n');
  const missingPath = path.join(OUTPUT_DIR, 'missing-vehicles.csv');
  fs.writeFileSync(missingPath, missingCsv);
  console.log(`Missing vehicles: ${missingPath}`);

  // Data errors CSV
  if (results.dataErrors.length > 0) {
    const errorsCsv = [
      'Tier,Make,Model,Year,Field,Expected,Actual',
      ...results.dataErrors.flatMap(e => 
        e.issues.map(i => `${e.tier},${e.make},${e.model},${e.year},${i.field},${i.expected},${i.actual}`)
      )
    ].join('\n');
    const errorsPath = path.join(OUTPUT_DIR, 'data-errors.csv');
    fs.writeFileSync(errorsPath, errorsCsv);
    console.log(`Data errors: ${errorsPath}`);
  }

  // Summary report
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('COVERAGE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total Target Vehicles: ${results.summary.totalTarget}`);
  console.log(`Total Covered:         ${results.summary.totalCovered}`);
  console.log(`Total Missing:         ${results.summary.totalMissing}`);
  console.log(`Coverage:              ${results.summary.coveragePercent}%`);
  console.log();
  console.log('By Tier:');
  for (const tier of [1, 2, 3]) {
    const t = results.summary.byTier[tier];
    console.log(`  Tier ${tier}: ${t.covered}/${t.target} (${t.percent}%)`);
  }
  console.log();
  console.log('By Year:');
  for (const year of TARGET_YEARS) {
    const y = results.summary.byYear[year];
    console.log(`  ${year}: ${y.covered}/${y.target} (${y.percent}%)`);
  }
  console.log();
  console.log(`Data Errors Found: ${results.dataErrors.length}`);
  console.log('═══════════════════════════════════════════════════════════════');

  return results;
}

// Run
runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
