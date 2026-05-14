/**
 * HIGH Severity Fix #3: Analyze Missing Bolt Patterns
 * 
 * Find records with missing bolt_pattern, check siblings and Techfeed.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function analyze() {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   ANALYZE MISSING BOLT PATTERNS                               ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  // Find records with missing bolt pattern
  const missing = await sql`
    SELECT id, year, make, model, display_trim, modification_id,
           bolt_pattern, center_bore_mm, oem_tire_sizes, source
    FROM vehicle_fitments
    WHERE (bolt_pattern IS NULL OR bolt_pattern = '')
      AND certification_status = 'certified'
    ORDER BY year DESC, make, model, display_trim
  `;
  
  console.log(`Found ${missing.length} records with missing bolt pattern\n`);
  
  const results = {
    timestamp: new Date().toISOString(),
    totalMissing: missing.length,
    fixCandidates: [],
    needsManualReview: [],
    details: [],
  };
  
  for (const rec of missing) {
    // Check for sibling trims with bolt pattern
    const [sibling] = await sql`
      SELECT bolt_pattern, center_bore_mm, display_trim
      FROM vehicle_fitments
      WHERE year = ${rec.year}
        AND make = ${rec.make}
        AND model = ${rec.model}
        AND bolt_pattern IS NOT NULL
        AND bolt_pattern != ''
        AND certification_status = 'certified'
      LIMIT 1
    `;
    
    // Also check adjacent years
    const [adjacentYear] = await sql`
      SELECT bolt_pattern, center_bore_mm, year, display_trim
      FROM vehicle_fitments
      WHERE make = ${rec.make}
        AND model = ${rec.model}
        AND year BETWEEN ${rec.year - 2} AND ${rec.year + 2}
        AND bolt_pattern IS NOT NULL
        AND bolt_pattern != ''
        AND certification_status = 'certified'
      LIMIT 1
    `;
    
    const detail = {
      id: rec.id,
      year: rec.year,
      make: rec.make,
      model: rec.model,
      trim: rec.display_trim,
      source: rec.source,
      siblingBolt: sibling?.bolt_pattern || null,
      siblingTrim: sibling?.display_trim || null,
      adjacentYearBolt: adjacentYear?.bolt_pattern || null,
      adjacentYear: adjacentYear?.year || null,
    };
    
    results.details.push(detail);
    
    if (sibling?.bolt_pattern) {
      // Same year sibling has bolt pattern - high confidence fix
      results.fixCandidates.push({
        ...detail,
        proposedFix: sibling.bolt_pattern,
        confidence: 'high-sibling-match',
      });
    } else if (adjacentYear?.bolt_pattern) {
      // Adjacent year has bolt pattern - medium confidence
      results.fixCandidates.push({
        ...detail,
        proposedFix: adjacentYear.bolt_pattern,
        confidence: 'medium-adjacent-year',
      });
    } else {
      results.needsManualReview.push({
        ...detail,
        reason: 'no_reference_found',
      });
    }
    
    console.log(`${rec.year} ${rec.make} ${rec.model} "${rec.display_trim}"`);
    console.log(`  sibling: ${sibling?.bolt_pattern || 'none'}, adjacent: ${adjacentYear?.bolt_pattern || 'none'}`);
  }
  
  // Summary
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`ANALYSIS COMPLETE`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Total missing:           ${results.totalMissing}`);
  console.log(`Fix candidates:          ${results.fixCandidates.length}`);
  console.log(`  - High confidence:     ${results.fixCandidates.filter(f => f.confidence === 'high-sibling-match').length}`);
  console.log(`  - Medium confidence:   ${results.fixCandidates.filter(f => f.confidence === 'medium-adjacent-year').length}`);
  console.log(`Needs manual review:     ${results.needsManualReview.length}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  
  // Write results
  const outputDir = resolve(__dirname, 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, 'missing-bolt-analysis.json');
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Results written to: ${outputPath}`);
  
  await sql.end();
  return results;
}

analyze().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
