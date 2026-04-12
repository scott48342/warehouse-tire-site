/**
 * Quick Integrity Scan - Fast preliminary audit
 * Gets high-level statistics while full audit runs
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

interface ScanStats {
  totalRecords: number;
  byYear: Record<number, number>;
  missingTireSizes: number;
  withTireSizes: number;
  sourceBreakdown: Record<string, number>;
  issueBreakdown: {
    legacyContamination: number;
    siblingAggregation: number;
    broadDiameterSpread: number;
    crossGenInherit: number;
  };
}

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
  if (match) return Math.floor(parseFloat(match[1]));
  return null;
}

function getWheelDiameters(tireSizes: string[]): number[] {
  const diameters = new Set<number>();
  for (const size of tireSizes) {
    const d = extractRimDiameter(size);
    if (d !== null) diameters.add(d);
  }
  return Array.from(diameters).sort((a, b) => a - b);
}

// Models that should NOT have 15"/16" tires in modern years
const MODERN_ONLY_MODELS = [
  'corvette', 'camaro', 'mustang', 'challenger', 'charger',
  'silverado-1500', 'sierra-1500', 'f-150', '1500', 'tundra',
  'tahoe', 'yukon', 'suburban', 'expedition', 'escalade',
  'navigator', 'durango', 'grand-cherokee'
];

async function scan() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  const stats: ScanStats = {
    totalRecords: 0,
    byYear: {},
    missingTireSizes: 0,
    withTireSizes: 0,
    sourceBreakdown: {},
    issueBreakdown: {
      legacyContamination: 0,
      siblingAggregation: 0,
      broadDiameterSpread: 0,
      crossGenInherit: 0,
    }
  };

  try {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("           QUICK TIRE-SPEC INTEGRITY SCAN (2000-2026)          ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const { rows } = await pool.query(`
      SELECT year, make, model, display_trim, modification_id, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2026
      ORDER BY year, make, model
    `);

    stats.totalRecords = rows.length;
    console.log(`Scanning ${rows.length} records...\n`);

    for (const row of rows) {
      // Count by year
      stats.byYear[row.year] = (stats.byYear[row.year] || 0) + 1;

      // Count by source
      const source = row.source || "null";
      stats.sourceBreakdown[source] = (stats.sourceBreakdown[source] || 0) + 1;

      const tireSizes = (row.oem_tire_sizes || []) as string[];
      
      // Missing tire sizes
      if (!tireSizes || tireSizes.length === 0) {
        stats.missingTireSizes++;
        continue;
      }
      
      stats.withTireSizes++;
      const diameters = getWheelDiameters(tireSizes);

      // Legacy contamination check
      if (row.year >= 2015 && MODERN_ONLY_MODELS.includes(row.model)) {
        const hasLegacy = diameters.some(d => d <= 16);
        if (hasLegacy) {
          stats.issueBreakdown.legacyContamination++;
        }
      }

      // Sibling aggregation check
      if (row.display_trim && row.display_trim.includes(',')) {
        stats.issueBreakdown.siblingAggregation++;
      }

      // Broad diameter spread check (> 4 inches)
      if (diameters.length > 1) {
        const spread = diameters[diameters.length - 1] - diameters[0];
        if (spread > 4) {
          stats.issueBreakdown.broadDiameterSpread++;
        }
      }

      // Cross-generation inherit check
      if (source && source.includes('inherit')) {
        // Check if sizes seem wrong for the year
        const minDia = Math.min(...diameters);
        if (row.year >= 2020 && minDia <= 15) {
          stats.issueBreakdown.crossGenInherit++;
        }
      }
    }

    // Print results
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("                         SUMMARY                                ");
    console.log("═══════════════════════════════════════════════════════════════\n");

    console.log(`Total Records: ${stats.totalRecords}`);
    console.log(`  With Tire Sizes: ${stats.withTireSizes} (${(stats.withTireSizes / stats.totalRecords * 100).toFixed(1)}%)`);
    console.log(`  Missing Tire Sizes: ${stats.missingTireSizes} (${(stats.missingTireSizes / stats.totalRecords * 100).toFixed(1)}%)`);
    console.log("");

    console.log("ISSUE BREAKDOWN:");
    console.log(`  Legacy Contamination: ${stats.issueBreakdown.legacyContamination}`);
    console.log(`  Sibling Aggregation: ${stats.issueBreakdown.siblingAggregation}`);
    console.log(`  Broad Diameter Spread (>4"): ${stats.issueBreakdown.broadDiameterSpread}`);
    console.log(`  Cross-Gen Inherit Issues: ${stats.issueBreakdown.crossGenInherit}`);
    console.log("");

    console.log("BY YEAR (sample):");
    const years = Object.keys(stats.byYear).map(Number).sort((a, b) => b - a);
    for (const year of years.slice(0, 10)) {
      console.log(`  ${year}: ${stats.byYear[year]} records`);
    }
    console.log("");

    console.log("TOP 10 SOURCES:");
    const sortedSources = Object.entries(stats.sourceBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [source, count] of sortedSources) {
      console.log(`  ${source}: ${count}`);
    }

    // Save stats
    const fs = await import("fs/promises");
    await fs.writeFile(
      "./scripts/fitment-audit/quick-scan-stats.json",
      JSON.stringify(stats, null, 2)
    );
    console.log("\n📄 Stats saved to: scripts/fitment-audit/quick-scan-stats.json");

  } finally {
    await pool.end();
  }
}

scan().catch(console.error);
