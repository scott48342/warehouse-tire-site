/**
 * CANONICAL FITMENT METRICS SHEET
 * Single source of truth for all coverage counts
 * 
 * Run: npx tsx scripts/canonical-metrics.ts
 */

import * as https from 'https';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROD_API = "https://shop.warehousetiredirect.com";

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ error: 'timeout' }), 30000);
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

interface Metrics {
  timestamp: string;
  source: string;
  
  // Raw counts from selector APIs
  uniqueMakes: { count: number; definition: string; source: string };
  uniqueModels: { count: number; definition: string; source: string };
  uniqueYMM: { count: number; definition: string; source: string };
  totalTrimRecords: { count: number; definition: string; source: string };
  
  // Selector-reachable (what users can actually select)
  selectorReachableYMM: { count: number; definition: string; source: string };
  selectorReachableTrims: { count: number; definition: string; source: string };
  
  // Issues
  singleTrimYMM: { count: number; definition: string; source: string };
  
  // Raw data for verification
  makesList: string[];
  modelsByMake: Record<string, string[]>;
}

async function collectMetrics(): Promise<Metrics> {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CANONICAL FITMENT METRICS - PRODUCTION");
  console.log("  Source: " + PROD_API);
  console.log("  Time: " + new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Get all makes from production API
  console.log("Fetching makes...");
  const makesData = await fetchJson(`${PROD_API}/api/vehicles/makes`);
  const makes: string[] = makesData.results || [];
  console.log(`  Found ${makes.length} makes\n`);

  // 2. Get all models for each make
  console.log("Fetching models per make...");
  const modelsByMake: Record<string, string[]> = {};
  let totalModels = 0;
  
  for (const make of makes) {
    const modelsData = await fetchJson(`${PROD_API}/api/vehicles/models?make=${encodeURIComponent(make)}`);
    const models = modelsData.results || [];
    modelsByMake[make] = models;
    totalModels += models.length;
  }
  console.log(`  Found ${totalModels} total models across ${makes.length} makes\n`);

  // 3. Get all Y/M/M combinations and trim counts
  console.log("Fetching years and trims (this takes a while)...");
  let totalYMM = 0;
  let totalTrims = 0;
  let singleTrimYMM = 0;
  
  for (const make of makes) {
    process.stdout.write(`  [${make}] `);
    let makeTrims = 0;
    let makeYMM = 0;
    
    for (const model of modelsByMake[make]) {
      const yearsData = await fetchJson(`${PROD_API}/api/vehicles/years?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
      const years = yearsData.results || [];
      
      for (const year of years) {
        const trimsData = await fetchJson(`${PROD_API}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
        const trims = trimsData.results || [];
        
        totalYMM++;
        makeYMM++;
        totalTrims += trims.length;
        makeTrims += trims.length;
        
        if (trims.length === 1) {
          singleTrimYMM++;
        }
      }
    }
    console.log(`${makeYMM} Y/M/M, ${makeTrims} trims`);
  }

  const metrics: Metrics = {
    timestamp: new Date().toISOString(),
    source: PROD_API,
    
    uniqueMakes: {
      count: makes.length,
      definition: "Distinct make names returned by /api/vehicles/makes",
      source: "GET /api/vehicles/makes → results.length"
    },
    
    uniqueModels: {
      count: totalModels,
      definition: "Sum of distinct models across all makes, from /api/vehicles/models",
      source: "SUM(GET /api/vehicles/models?make=X → results.length) for each make"
    },
    
    uniqueYMM: {
      count: totalYMM,
      definition: "Total Year/Make/Model combinations reachable via selector APIs",
      source: "Count of all (year, make, model) tuples from iterating makes→models→years"
    },
    
    totalTrimRecords: {
      count: totalTrims,
      definition: "Sum of all trim/modification options across all Y/M/M combinations",
      source: "SUM(GET /api/vehicles/trims?year=Y&make=M&model=Mo → results.length)"
    },
    
    selectorReachableYMM: {
      count: totalYMM,
      definition: "Y/M/M combinations a user can reach via the selector dropdowns (same as uniqueYMM for production)",
      source: "Same as uniqueYMM - these APIs only return reachable combinations"
    },
    
    selectorReachableTrims: {
      count: totalTrims,
      definition: "Trim/modification options a user can select (same as totalTrimRecords)",
      source: "Same as totalTrimRecords"
    },
    
    singleTrimYMM: {
      count: singleTrimYMM,
      definition: "Y/M/M combinations that only have 1 trim option (cosmetic issue - usually 'Base')",
      source: "Count where trims.length === 1 for a Y/M/M"
    },
    
    makesList: makes,
    modelsByMake: modelsByMake
  };

  return metrics;
}

async function main() {
  const metrics = await collectMetrics();
  
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  CANONICAL METRICS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  console.log("METRIC                          | COUNT      | SOURCE");
  console.log("--------------------------------|------------|----------------------------------");
  console.log(`1. Unique Makes                 | ${String(metrics.uniqueMakes.count).padStart(10)} | Production API /api/vehicles/makes`);
  console.log(`2. Unique Models                | ${String(metrics.uniqueModels.count).padStart(10)} | Production API /api/vehicles/models`);
  console.log(`3. Unique Y/M/M Combinations    | ${String(metrics.uniqueYMM.count).padStart(10)} | Production API iteration`);
  console.log(`4. Total Trim Records           | ${String(metrics.totalTrimRecords.count).padStart(10)} | Production API /api/vehicles/trims`);
  console.log(`5. Selector-Reachable Y/M/M     | ${String(metrics.selectorReachableYMM.count).padStart(10)} | Same as #3 (API = selector)`);
  console.log(`6. Selector-Reachable Trims     | ${String(metrics.selectorReachableTrims.count).padStart(10)} | Same as #4 (API = selector)`);
  console.log(`7. Single-Trim Y/M/M (cosmetic) | ${String(metrics.singleTrimYMM.count).padStart(10)} | Y/M/M where trims.length === 1`);
  console.log("--------------------------------|------------|----------------------------------");
  
  console.log("\nDEFINITIONS:");
  console.log("• Unique Makes: Distinct manufacturer names in the selector");
  console.log("• Unique Models: Distinct model names across all makes");
  console.log("• Y/M/M: Year + Make + Model combination (e.g., 2020 Ford F-150)");
  console.log("• Trim Record: A selectable modification (e.g., 2020 Ford F-150 XLT)");
  console.log("• Single-Trim Y/M/M: A Y/M/M with only one trim option (usually 'Base')");
  console.log("  → This is a COSMETIC issue, not a search failure");
  
  console.log("\nNOTES:");
  console.log("• These counts are from PRODUCTION APIs, which only return selector-reachable data");
  console.log("• The selector APIs filter to vehicles with fitment coverage");
  console.log("• 'Missing models' would be models NOT in these APIs (e.g., Ford Focus)");
  console.log("• Metrics 8 & 9 require the YMM audit to complete (search result testing)");
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('scripts/canonical-metrics.json', JSON.stringify(metrics, null, 2));
  console.log("\nFull metrics saved to scripts/canonical-metrics.json");
}

main().catch(e => { console.error("Error:", e); process.exit(1); });
