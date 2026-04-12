/**
 * Analyze remaining cross-generation contamination
 * Identifies patterns and sources of bad inheritance
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

interface ContaminatedRecord {
  id: string;
  year: number;
  make: string;
  model: string;
  displayTrim: string;
  tireSizes: string[];
  minDiameter: number;
  source: string;
  expectedMinDiameter: number;
  inheritedFromYear?: number;
}

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
  if (match) return Math.floor(parseFloat(match[1]));
  return null;
}

function getMinDiameter(tireSizes: string[]): number {
  const diameters = tireSizes.map(extractRimDiameter).filter((d): d is number => d !== null);
  return diameters.length > 0 ? Math.min(...diameters) : 0;
}

// Expected minimum wheel diameters by vehicle class and year
function getExpectedMinDiameter(year: number, model: string): number {
  const modelLower = model.toLowerCase();
  
  // Corvette generations
  if (modelLower.includes('corvette')) {
    if (year >= 2020) return 19; // C8
    if (year >= 2014) return 18; // C7
    if (year >= 2005) return 17; // C6
    return 15; // C5 and earlier
  }
  
  // Camaro generations
  if (modelLower.includes('camaro')) {
    if (year >= 2016) return 18; // 6th gen
    if (year >= 2010) return 18; // 5th gen
    return 15; // Earlier
  }
  
  // Full-size trucks
  if (modelLower.includes('silverado') || modelLower.includes('sierra') || 
      modelLower.includes('f-150') || modelLower.includes('1500')) {
    if (year >= 2019) return 17; // Current gen
    if (year >= 2014) return 17; // Previous gen
    return 15; // GMT900 and earlier had 15/16 options
  }
  
  // Luxury sedans
  if (modelLower.includes('s-class') || modelLower.includes('7-series')) {
    if (year >= 2014) return 17;
    if (year >= 2007) return 16;
    return 15;
  }
  
  // Default
  if (year >= 2020) return 16;
  if (year >= 2015) return 15;
  return 14;
}

async function analyze() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("    ANALYZING CROSS-GENERATION CONTAMINATION                    ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // Find all records with source containing 'inherit' that have suspiciously small diameters
    const { rows } = await pool.query(`
      SELECT id, year, make, model, display_trim, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE source LIKE '%inherit%'
        AND year >= 2010
      ORDER BY year, make, model
    `);

    console.log(`Found ${rows.length} records with 'inherit' source (2010+)\n`);

    const contaminated: ContaminatedRecord[] = [];
    const byVehicle: Record<string, ContaminatedRecord[]> = {};

    for (const row of rows) {
      const tireSizes = (row.oem_tire_sizes || []) as string[];
      const minDia = getMinDiameter(tireSizes);
      const expectedMin = getExpectedMinDiameter(row.year, row.model);
      
      // Check if contaminated
      if (minDia < expectedMin) {
        // Try to extract inherited year from source
        let inheritedFromYear: number | undefined;
        const yearMatch = row.source.match(/inherit.*?(\d{4})/i);
        if (yearMatch) {
          inheritedFromYear = parseInt(yearMatch[1]);
        }
        
        const record: ContaminatedRecord = {
          id: row.id,
          year: row.year,
          make: row.make,
          model: row.model,
          displayTrim: row.display_trim || "Base",
          tireSizes,
          minDiameter: minDia,
          source: row.source,
          expectedMinDiameter: expectedMin,
          inheritedFromYear,
        };
        
        contaminated.push(record);
        
        const key = `${row.make}/${row.model}`;
        if (!byVehicle[key]) byVehicle[key] = [];
        byVehicle[key].push(record);
      }
    }

    console.log(`CONTAMINATED RECORDS: ${contaminated.length}\n`);

    // Group by vehicle type for analysis
    console.log("BY VEHICLE:");
    for (const [vehicle, records] of Object.entries(byVehicle).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n${vehicle}: ${records.length} records`);
      const years = [...new Set(records.map(r => r.year))].sort();
      console.log(`  Years: ${years.join(', ')}`);
      console.log(`  Min diameter found: ${Math.min(...records.map(r => r.minDiameter))}"`);
      console.log(`  Expected min: ${records[0].expectedMinDiameter}"`);
      console.log(`  Sources: ${[...new Set(records.map(r => r.source))].join(', ')}`);
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("    DETAILED CONTAMINATION LIST                                 ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Print each contaminated record
    for (const r of contaminated.slice(0, 30)) {
      console.log(`${r.year} ${r.make} ${r.model} "${r.displayTrim}"`);
      console.log(`  Sizes: ${r.tireSizes.slice(0, 4).join(', ')}${r.tireSizes.length > 4 ? '...' : ''}`);
      console.log(`  Min diameter: ${r.minDiameter}" (expected: ${r.expectedMinDiameter}"+)`);
      console.log(`  Source: ${r.source}`);
      if (r.inheritedFromYear) {
        console.log(`  Inherited from: ${r.inheritedFromYear}`);
      }
      console.log("");
    }

    if (contaminated.length > 30) {
      console.log(`... and ${contaminated.length - 30} more\n`);
    }

    // Save analysis
    const fs = await import("fs/promises");
    await fs.writeFile(
      "./scripts/fitment-audit/cross-gen-analysis.json",
      JSON.stringify({ total: contaminated.length, byVehicle, records: contaminated }, null, 2)
    );
    console.log("📄 Analysis saved to: scripts/fitment-audit/cross-gen-analysis.json");

    // Summary of what needs fixing
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("    RECOMMENDED FIXES                                           ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const vehicleKeys = Object.keys(byVehicle);
    for (const key of vehicleKeys.slice(0, 10)) {
      const records = byVehicle[key];
      const [make, model] = key.split('/');
      const years = [...new Set(records.map(r => r.year))].sort();
      const expectedMin = records[0].expectedMinDiameter;
      
      console.log(`FIX: ${key}`);
      console.log(`  Years to fix: ${years.join(', ')}`);
      console.log(`  Action: Update to ${expectedMin}"+ tire sizes or remove inherit records`);
      console.log("");
    }

  } finally {
    await pool.end();
  }
}

analyze().catch(console.error);
