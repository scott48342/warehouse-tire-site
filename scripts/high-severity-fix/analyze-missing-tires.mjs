/**
 * HIGH Severity Fix #2: Analyze Missing Tire Specs
 * 
 * Focus: 2018 HD trucks/vans with no valid tire sizes
 * Check USAF for data, then sibling records as supporting evidence.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

// USAF API check (we'll use stock check endpoint)
async function checkUSAF(year, make, model) {
  // For now, return null - we'll check manually or via existing USAF audit data
  return null;
}

async function analyze() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   ANALYZE MISSING TIRE SPECS                                  ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  // Find records with missing/invalid tire specs
  const badRecords = await sql`
    SELECT id, year, make, model, display_trim, modification_id,
           oem_tire_sizes, bolt_pattern, center_bore_mm, source
    FROM vehicle_fitments
    WHERE certification_status = 'certified'
      AND (
        oem_tire_sizes IS NULL
        OR oem_tire_sizes = '[]'::jsonb
        OR oem_tire_sizes = '[null]'::jsonb
        OR oem_tire_sizes = 'null'::jsonb
      )
    ORDER BY year, make, model, display_trim
  `;
  
  console.log(`Found ${badRecords.length} records with missing/null tire specs\n`);
  
  // Also find records where tire sizes array has invalid elements
  const invalidTireRecords = await sql`
    SELECT id, year, make, model, display_trim, oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE certification_status = 'certified'
      AND oem_tire_sizes IS NOT NULL
      AND oem_tire_sizes != '[]'::jsonb
      AND oem_tire_sizes != 'null'::jsonb
      AND jsonb_typeof(oem_tire_sizes) = 'array'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(oem_tire_sizes) elem
        WHERE elem ~ '^(P|LT)?\\d{2,3}/\\d{2,3}Z?R\\d{2}'
      )
    ORDER BY year, make, model, display_trim
  `;
  
  console.log(`Found ${invalidTireRecords.length} records with invalid tire format\n`);
  
  const allBad = [...badRecords, ...invalidTireRecords];
  
  const results = {
    timestamp: new Date().toISOString(),
    totalBadRecords: allBad.length,
    nullOrEmpty: badRecords.length,
    invalidFormat: invalidTireRecords.length,
    byMakeModel: {},
    fixCandidates: [],
    needsManualReview: [],
  };
  
  // Group by make/model
  for (const rec of allBad) {
    const key = `${rec.make}|${rec.model}`;
    if (!results.byMakeModel[key]) {
      results.byMakeModel[key] = {
        make: rec.make,
        model: rec.model,
        records: [],
      };
    }
    results.byMakeModel[key].records.push({
      id: rec.id,
      year: rec.year,
      trim: rec.display_trim,
      tireSizes: rec.oem_tire_sizes,
      source: rec.source,
    });
  }
  
  // For each group, check if sibling trims have tire data
  for (const [key, group] of Object.entries(results.byMakeModel)) {
    const { make, model, records } = group;
    
    // Get sibling trims with valid tire data
    const years = [...new Set(records.map(r => r.year))];
    const siblings = await sql`
      SELECT DISTINCT year, display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE make = ${make} 
        AND model = ${model}
        AND year = ANY(${years})
        AND certification_status = 'certified'
        AND oem_tire_sizes IS NOT NULL
        AND oem_tire_sizes != '[]'::jsonb
        AND oem_tire_sizes != 'null'::jsonb
        AND jsonb_typeof(oem_tire_sizes) = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(oem_tire_sizes) elem
          WHERE elem ~ '^(P|LT)?\\d{2,3}/\\d{2,3}Z?R\\d{2}'
        )
      ORDER BY year, display_trim
      LIMIT 5
    `;
    
    group.siblingTireSizes = siblings.map(s => ({
      year: s.year,
      trim: s.display_trim,
      sizes: s.oem_tire_sizes,
    }));
    
    // Classify
    if (siblings.length > 0) {
      // There's sibling data - could potentially use as reference
      for (const rec of records) {
        results.fixCandidates.push({
          ...rec,
          make, model,
          siblingReference: siblings[0],
          confidence: 'low-needs-usaf-confirmation',
        });
      }
    } else {
      // No sibling data available
      for (const rec of records) {
        results.needsManualReview.push({
          ...rec,
          make, model,
          reason: 'no_sibling_data',
        });
      }
    }
  }
  
  // Summary
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`ANALYSIS COMPLETE`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Total bad records:       ${results.totalBadRecords}`);
  console.log(`Null/empty:              ${results.nullOrEmpty}`);
  console.log(`Invalid format:          ${results.invalidFormat}`);
  console.log(`Fix candidates:          ${results.fixCandidates.length} (need USAF confirmation)`);
  console.log(`Needs manual review:     ${results.needsManualReview.length}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  
  // Show by make/model
  console.log(`By Make/Model:`);
  const sorted = Object.entries(results.byMakeModel)
    .sort((a, b) => b[1].records.length - a[1].records.length);
  for (const [key, group] of sorted.slice(0, 20)) {
    console.log(`  ${group.make} ${group.model}: ${group.records.length} records`);
  }
  
  // Write results
  const outputDir = resolve(__dirname, 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, 'missing-tires-analysis.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to: ${outputPath}`);
  
  await sql.end();
  return results;
}

analyze().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
