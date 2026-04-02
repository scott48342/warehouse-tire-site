/**
 * Coverage Gap Analysis
 * Identifies missing vehicles from 2000 to current
 */

import * as https from 'https';

const PROD_BASE = "https://shop.warehousetiredirect.com";

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ error: 'timeout' }), 15000);
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); } catch { resolve({ error: 'parse' }); }
      });
    }).on('error', (e) => { clearTimeout(timeout); resolve({ error: e.message }); });
  });
}

// Major makes that should have coverage 2000-current
const EXPECTED_MAKES = [
  'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge',
  'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia',
  'Land Rover', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes', 'Mini', 'Mitsubishi',
  'Nissan', 'Porsche', 'Ram', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
];

interface CoverageStats {
  make: string;
  modelsInDB: string[];
  yearRange: { min: number; max: number };
  totalTrims: number;
  singleTrimYears: { model: string; year: number; trim: string }[];
  missingYears: { model: string; years: number[] }[];
}

async function analyzeMake(make: string): Promise<CoverageStats> {
  const stats: CoverageStats = {
    make,
    modelsInDB: [],
    yearRange: { min: 9999, max: 0 },
    totalTrims: 0,
    singleTrimYears: [],
    missingYears: []
  };

  // Get models for this make
  const modelsData = await fetchJson(`${PROD_BASE}/api/vehicles/models?make=${encodeURIComponent(make)}`);
  const models = modelsData.results || [];
  stats.modelsInDB = models;

  for (const model of models) {
    // Get years for this model
    const yearsData = await fetchJson(`${PROD_BASE}/api/vehicles/years?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const years = (yearsData.results || []).map((y: any) => Number(y)).filter((y: number) => !isNaN(y));
    
    if (years.length === 0) continue;

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    
    if (minYear < stats.yearRange.min) stats.yearRange.min = minYear;
    if (maxYear > stats.yearRange.max) stats.yearRange.max = maxYear;

    // Check for gaps in years (if a model exists 2005-2020 but is missing 2010-2015)
    const gaps: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      if (!years.includes(y)) gaps.push(y);
    }
    if (gaps.length > 0) {
      stats.missingYears.push({ model, years: gaps });
    }

    // Check each year for single-trim issues
    for (const year of years) {
      const trimsData = await fetchJson(`${PROD_BASE}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
      const trims = trimsData.results || [];
      stats.totalTrims += trims.length;

      if (trims.length === 1) {
        stats.singleTrimYears.push({ model, year, trim: trims[0]?.label || 'unknown' });
      }
    }
  }

  return stats;
}

async function runAnalysis() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VEHICLE COVERAGE GAP ANALYSIS (2000-2026)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // First get all makes from the API
  const makesData = await fetchJson(`${PROD_BASE}/api/vehicles/makes`);
  const availableMakes = makesData.results || [];
  console.log(`Total makes in database: ${availableMakes.length}\n`);

  // Check which expected makes are missing
  const missingMakes = EXPECTED_MAKES.filter(m => 
    !availableMakes.some((am: string) => am.toLowerCase() === m.toLowerCase())
  );
  if (missingMakes.length > 0) {
    console.log(`⚠️  MISSING MAJOR MAKES: ${missingMakes.join(', ')}\n`);
  }

  // Analyze coverage for key makes
  const keyMakes = ['Chrysler', 'Dodge', 'Ford', 'Chevrolet', 'Toyota', 'Honda', 'Nissan', 'BMW', 'Mercedes'];
  
  const allStats: CoverageStats[] = [];
  let totalSingleTrimIssues = 0;
  let totalMissingYearGaps = 0;

  for (const make of keyMakes) {
    console.log(`Analyzing ${make}...`);
    const stats = await analyzeMake(make);
    allStats.push(stats);
    totalSingleTrimIssues += stats.singleTrimYears.length;
    totalMissingYearGaps += stats.missingYears.reduce((acc, m) => acc + m.years.length, 0);
  }

  // Print summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const stats of allStats) {
    console.log(`\n[${stats.make}]`);
    console.log(`  Models: ${stats.modelsInDB.length} (${stats.modelsInDB.slice(0, 8).join(', ')}${stats.modelsInDB.length > 8 ? '...' : ''})`);
    console.log(`  Year range: ${stats.yearRange.min}-${stats.yearRange.max}`);
    console.log(`  Total trims: ${stats.totalTrims}`);
    console.log(`  Single-trim Y/M/M combos: ${stats.singleTrimYears.length}`);
    
    if (stats.singleTrimYears.length > 0) {
      console.log(`    Examples: ${stats.singleTrimYears.slice(0, 5).map(s => `${s.year} ${s.model} (${s.trim})`).join(', ')}`);
    }
    
    if (stats.missingYears.length > 0) {
      console.log(`  Year gaps: ${stats.missingYears.length} models have gaps`);
      for (const mg of stats.missingYears.slice(0, 3)) {
        console.log(`    ${mg.model}: missing ${mg.years.slice(0, 10).join(', ')}${mg.years.length > 10 ? '...' : ''}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  TOTALS`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Single-trim issues (likely missing data): ${totalSingleTrimIssues}`);
  console.log(`  Year gaps (missing years in model runs): ${totalMissingYearGaps}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Save results
  const fs = require('fs');
  fs.writeFileSync('scripts/coverage-gap-analysis.json', JSON.stringify(allStats, null, 2));
  console.log("Detailed results saved to scripts/coverage-gap-analysis.json");
}

runAnalysis().catch(e => { console.error("Analysis failed:", e); process.exit(1); });
