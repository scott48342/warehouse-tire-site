#!/usr/bin/env npx tsx

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MEDIUM-CONFIDENCE INHERITANCE REVIEW
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Reviews the 47 medium-confidence candidates and determines which are safe
 * to promote based on generation knowledge and platform continuity.
 * 
 * SAFETY CRITERIA FOR MEDIUM → SAFE:
 * 1. Same generation (we might have missed it in generation map)
 * 2. Same platform with verified spec continuity
 * 3. Target year is within known model refresh boundaries
 * 
 * REJECT CRITERIA:
 * 1. Known platform/generation change between source and target
 * 2. Spec discontinuity (e.g., bolt pattern change)
 * 
 * @created 2026-03-27
 */

import * as dotenv from "dotenv";
import pg from "pg";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

// ═══════════════════════════════════════════════════════════════════════════════
// US SALES VOLUME RANKING (approximate, for prioritization)
// Higher = more important
// ═══════════════════════════════════════════════════════════════════════════════

const US_SALES_RANK: Record<string, number> = {
  // Full-size trucks (top sellers)
  'ford/f-150': 100,
  'chevrolet/silverado-1500': 95,
  'ram/1500': 90,
  'gmc/sierra-1500': 85,
  'toyota/tundra': 70,
  'chevrolet/silverado-2500-hd': 65,
  
  // Full-size SUVs
  'chevrolet/tahoe': 80,
  'ford/bronco': 75,
  'chevrolet/suburban': 70,
  'gmc/yukon': 65,
  'jeep/grand-cherokee': 75,
  
  // Mid-size trucks
  'toyota/tacoma': 80,
  'ford/ranger': 65,
  'jeep/gladiator': 60,
  
  // Mid-size SUVs (very popular)
  'toyota/rav4': 90,
  'honda/cr-v': 88,
  'toyota/highlander': 75,
  'toyota/4runner': 70,
  'subaru/outback': 65,
  'subaru/forester': 60,
  'hyundai/tucson': 55,
  'kia/telluride': 50,
  
  // Sedans/Compacts
  'honda/civic': 75,
  'toyota/camry': 80,
  'chevrolet/impala': 30,
  'chrysler/300': 25,
  'chrysler/300c': 20,
  
  // Luxury/Other
  'audi/a4': 35,
  'audi/a6': 30,
  'bmw/3-series': 40,
  'lincoln/mkz': 15,
  'gmc/acadia': 45,
  
  // Off-road icons
  'jeep/wrangler': 70,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION KNOWLEDGE FOR REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

const GENERATION_KNOWLEDGE: Record<string, Record<number, { gen: string; safe: boolean; notes?: string }>> = {
  // Ford F-150: 12th gen 2009-2014, 13th gen 2015-2020, 14th gen 2021-2025
  'ford/f-150': {
    2014: { gen: '12th', safe: false, notes: 'Gen boundary: 12th gen ends, 13th starts 2015' },
    2026: { gen: '14th+', safe: true, notes: 'Likely continuation of 14th gen' },
  },
  
  // Chevy Silverado 1500: 3rd gen 2014-2018, 4th gen 2019-2025
  'chevrolet/silverado-1500': {
    2013: { gen: '3rd', safe: true, notes: 'Same K2 platform as 2014' },
    2026: { gen: '4th+', safe: true, notes: 'Likely continuation of T1 platform' },
  },
  
  // Chevy Silverado 2500 HD: 3rd gen 2015-2019, 4th gen 2020-2024
  'chevrolet/silverado-2500-hd': {
    2017: { gen: '3rd', safe: true, notes: 'Same platform as 2018' },
    2019: { gen: '3rd/4th', safe: false, notes: 'Gen boundary: 2019 HD still 3rd gen but 2020 is 4th' },
  },
  
  // Chevy Tahoe: 4th gen 2015-2020, 5th gen 2021-2025
  'chevrolet/tahoe': {
    2026: { gen: '5th+', safe: true, notes: 'Likely continuation of 5th gen' },
  },
  
  // Ford Bronco: 6th gen 2021-present
  'ford/bronco': {
    2026: { gen: '6th', safe: true, notes: 'Same gen, no redesign expected' },
  },
  
  // Ford Ranger: 6th gen 2019-2023, 7th gen 2024+
  'ford/ranger': {
    2018: { gen: '6th pre', safe: false, notes: 'Ranger returned to US in 2019, no 2018 model' },
    2026: { gen: '7th', safe: true, notes: 'Same gen as 2024-2025' },
  },
  
  // GMC Sierra 1500
  'gmc/sierra-1500': {
    2026: { gen: '5th+', safe: true, notes: 'Same as Silverado, likely continuation' },
  },
  
  // Honda Civic: 10th gen 2016-2021, 11th gen 2022+
  'honda/civic': {
    2019: { gen: '10th', safe: true, notes: 'Same platform as 2020' },
    2021: { gen: '10th/11th', safe: false, notes: 'Gen boundary: 11th gen starts 2022' },
  },
  
  // Honda CR-V: 4th gen 2012-2016, 5th gen 2017-2022, 6th gen 2023+
  'honda/cr-v': {
    2016: { gen: '4th/5th', safe: false, notes: 'Gen boundary: 5th gen starts 2017' },
    2026: { gen: '6th', safe: true, notes: 'Same platform as 2023-2025' },
  },
  
  // Hyundai Tucson: 3rd gen 2015-2021, 4th gen 2022+
  'hyundai/tucson': {
    2021: { gen: '3rd/4th', safe: false, notes: 'Gen boundary: 4th gen starts 2022' },
    2023: { gen: '4th', safe: true, notes: 'Same platform as 2022' },
  },
  
  // Jeep Gladiator: JT 2020+
  'jeep/gladiator': {
    2019: { gen: 'JT pre', safe: false, notes: 'Gladiator launched 2020, no 2019 model in production' },
  },
  
  // Jeep Grand Cherokee: WK2 2011-2021, WL 2022+
  'jeep/grand-cherokee': {
    2010: { gen: 'WK/WK2', safe: false, notes: 'Gen boundary: WK2 starts 2011' },
  },
  
  // Kia Telluride: 1st gen 2020+
  'kia/telluride': {
    2020: { gen: '1st', safe: true, notes: 'Same gen as 2021, launched 2020' },
    2022: { gen: '1st', safe: true, notes: 'Same gen as 2021' },
  },
  
  // Toyota Camry: 8th gen 2018+
  'toyota/camry': {
    2018: { gen: '8th', safe: true, notes: 'Same TNGA-K platform' },
    2021: { gen: '8th', safe: true, notes: 'Same platform, refresh only' },
    2023: { gen: '8th', safe: true, notes: 'Same platform' },
    2025: { gen: '8th', safe: true, notes: 'Same platform' },
  },
  
  // Toyota Highlander: 4th gen 2020+
  'toyota/highlander': {
    2019: { gen: '3rd/4th', safe: false, notes: 'Gen boundary: 4th gen starts 2020' },
    2026: { gen: '4th', safe: true, notes: 'Same platform' },
  },
  
  // Toyota RAV4: 4th gen 2013-2018, 5th gen 2019+
  'toyota/rav4': {
    2018: { gen: '4th/5th', safe: false, notes: 'Gen boundary: 5th gen starts 2019' },
  },
  
  // Toyota Tacoma: 3rd gen 2016-2023, 4th gen 2024+
  'toyota/tacoma': {
    2015: { gen: '2nd/3rd', safe: false, notes: 'Gen boundary: 3rd gen starts 2016' },
    2026: { gen: '4th', safe: true, notes: 'Same platform as 2024-2025' },
  },
  
  // Toyota Tundra: 2nd gen 2007-2021, 3rd gen 2022+
  'toyota/tundra': {
    2021: { gen: '2nd/3rd', safe: false, notes: 'Gen boundary: 3rd gen starts 2022' },
    2026: { gen: '3rd', safe: true, notes: 'Same platform' },
  },
  
  // Toyota 4Runner: 5th gen 2010-2025 (very long run!)
  'toyota/4runner': {
    2026: { gen: '5th/6th', safe: false, notes: '6th gen expected 2025/2026' },
  },
  
  // Subaru Forester: 4th gen 2014-2018, 5th gen 2019+
  'subaru/forester': {
    2018: { gen: '4th/5th', safe: false, notes: 'Gen boundary: 5th gen starts 2019' },
    2026: { gen: '5th', safe: true, notes: 'Same platform' },
  },
  
  // Subaru Outback: 5th gen 2015-2019, 6th gen 2020+
  'subaru/outback': {
    2019: { gen: '5th/6th', safe: false, notes: 'Gen boundary: 6th gen starts 2020' },
    2026: { gen: '6th', safe: true, notes: 'Same platform' },
  },
  
  // Chrysler 300: 2nd gen 2011-2023 (long run)
  'chrysler/300': {
    2019: { gen: '2nd', safe: true, notes: 'Same LX platform as 2020' },
    2021: { gen: '2nd', safe: true, notes: 'Same platform' },
  },
  
  // Chrysler 300C: same as 300
  'chrysler/300c': {
    2011: { gen: '1st/2nd', safe: false, notes: 'Gen boundary: 2nd gen starts 2011' },
  },
  
  // Chevy Impala: 10th gen 2014-2020
  'chevrolet/impala': {
    2011: { gen: '9th/10th', safe: false, notes: 'Gen boundary: 10th gen starts 2014' },
  },
  
  // BMW 3-Series: F30 2012-2018, G20 2019+
  'bmw/3-series': {
    2017: { gen: 'F30', safe: true, notes: 'Same platform as 2018' },
    2019: { gen: 'F30/G20', safe: false, notes: 'Gen boundary: G20 starts 2019' },
  },
  
  // Audi A4: B9 2017+
  'audi/a4': {
    2020: { gen: 'B9', safe: true, notes: 'Same platform as 2021' },
    2022: { gen: 'B9', safe: true, notes: 'Same platform as 2021' },
  },
  
  // Audi A6: C7 2012-2018, C8 2019+
  'audi/a6': {
    2012: { gen: 'C7', safe: true, notes: 'Same platform as 2013' },
    2014: { gen: 'C7', safe: true, notes: 'Same platform as 2013' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

interface MediumCandidate {
  targetYear: number;
  targetMake: string;
  targetModel: string;
  sourceFitmentId: string;
  sourceYear: number;
  sourceMake: string;
  sourceModel: string;
  rule: string;
  reason: string;
}

interface ReviewResult {
  candidate: MediumCandidate;
  salesRank: number;
  sourceSpecs: any;
  safeToPromote: boolean;
  reviewNotes: string;
}

async function main() {
  // Load the report
  const reportFiles = fs.readdirSync('.').filter(f => f.startsWith('inheritance-report-') && f.endsWith('.json'));
  const latestReport = reportFiles.sort().reverse()[0];
  
  if (!latestReport) {
    console.error('No inheritance report found!');
    process.exit(1);
  }
  
  const report = JSON.parse(fs.readFileSync(latestReport, 'utf-8'));
  
  // Extract medium-confidence candidates
  const mediumCandidates: MediumCandidate[] = report.candidates.filter(
    (c: any) => c.confidence === 'medium'
  );
  
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('                  MEDIUM-CONFIDENCE INHERITANCE REVIEW');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Total medium-confidence candidates: ${mediumCandidates.length}`);
  console.log('');

  // Rank by sales volume
  const rankedCandidates = mediumCandidates.map(c => {
    const key = `${c.targetMake.toLowerCase()}/${c.targetModel.toLowerCase()}`;
    return {
      ...c,
      salesRank: US_SALES_RANK[key] || 10,
    };
  }).sort((a, b) => b.salesRank - a.salesRank);

  // Review each candidate
  const reviewResults: ReviewResult[] = [];
  
  for (const candidate of rankedCandidates) {
    const key = `${candidate.targetMake.toLowerCase()}/${candidate.targetModel.toLowerCase()}`;
    const genKnowledge = GENERATION_KNOWLEDGE[key]?.[candidate.targetYear];
    
    // Get source specs from DB
    const sourceResult = await pool.query(
      `SELECT bolt_pattern, center_bore_mm, thread_size, seat_type, 
              offset_min_mm, offset_max_mm, display_trim
       FROM vehicle_fitments WHERE id = $1`,
      [candidate.sourceFitmentId]
    );
    const sourceSpecs = sourceResult.rows[0] || {};
    
    // Determine if safe to promote
    let safeToPromote = false;
    let reviewNotes = '';
    
    if (genKnowledge) {
      safeToPromote = genKnowledge.safe;
      reviewNotes = genKnowledge.notes || '';
    } else {
      // Default: 1-year adjacent within same platform is generally safe
      // But mark for manual review
      reviewNotes = 'No specific generation knowledge - requires manual verification';
      safeToPromote = false;
    }
    
    reviewResults.push({
      candidate,
      salesRank: candidate.salesRank,
      sourceSpecs,
      safeToPromote,
      reviewNotes,
    });
  }

  // Print review table
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('                         REVIEW TABLE (by priority)');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  console.log('SAFE TO PROMOTE:');
  console.log('─'.repeat(100));
  
  const safeOnes = reviewResults.filter(r => r.safeToPromote);
  const unsafeOnes = reviewResults.filter(r => !r.safeToPromote);
  
  for (const r of safeOnes) {
    const c = r.candidate;
    console.log(`✅ ${c.targetYear} ${c.targetMake} ${c.targetModel}`);
    console.log(`   ← Source: ${c.sourceYear} ${c.sourceMake} ${c.sourceModel}`);
    console.log(`   Specs: ${r.sourceSpecs.bolt_pattern} | CB: ${r.sourceSpecs.center_bore_mm}mm | ${r.sourceSpecs.thread_size}`);
    console.log(`   Rank: ${r.salesRank} | Rule: ${c.rule}`);
    console.log(`   Notes: ${r.reviewNotes}`);
    console.log('');
  }
  
  console.log('');
  console.log('REQUIRES MANUAL REVIEW (not auto-promoted):');
  console.log('─'.repeat(100));
  
  for (const r of unsafeOnes) {
    const c = r.candidate;
    console.log(`⚠️  ${c.targetYear} ${c.targetMake} ${c.targetModel}`);
    console.log(`   ← Source: ${c.sourceYear} ${c.sourceMake} ${c.sourceModel}`);
    console.log(`   Specs: ${r.sourceSpecs.bolt_pattern} | CB: ${r.sourceSpecs.center_bore_mm}mm | ${r.sourceSpecs.thread_size}`);
    console.log(`   Rank: ${r.salesRank} | Rule: ${c.rule}`);
    console.log(`   Notes: ${r.reviewNotes}`);
    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('                              SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Safe to promote: ${safeOnes.length}`);
  console.log(`Requires manual review: ${unsafeOnes.length}`);
  console.log('');

  // Apply safe ones
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  
  if (shouldApply && safeOnes.length > 0) {
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    APPLYING REVIEWED-SAFE CANDIDATES');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    
    let applied = 0;
    let skipped = 0;
    
    for (const r of safeOnes) {
      const c = r.candidate;
      
      // Get full source record
      const srcResult = await pool.query(
        `SELECT * FROM vehicle_fitments WHERE id = $1`,
        [c.sourceFitmentId]
      );
      
      if (srcResult.rows.length === 0) {
        console.log(`  ❌ Source not found: ${c.sourceFitmentId}`);
        skipped++;
        continue;
      }
      
      const src = srcResult.rows[0];
      const newModificationId = `reviewed_${c.sourceYear}_${src.modification_id}`;
      
      try {
        await pool.query(`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id,
            raw_trim, display_trim, submodel,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm,
            oem_wheel_sizes, oem_tire_sizes,
            source
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13,
            $14, $15,
            $16
          )
          ON CONFLICT (year, make, model, modification_id) DO NOTHING
        `, [
          c.targetYear,
          c.targetMake.toLowerCase(),
          c.targetModel.toLowerCase(),
          newModificationId,
          src.raw_trim,
          src.display_trim,
          src.submodel,
          src.bolt_pattern,
          src.center_bore_mm,
          src.thread_size,
          src.seat_type,
          src.offset_min_mm,
          src.offset_max_mm,
          JSON.stringify(src.oem_wheel_sizes || []),
          JSON.stringify(src.oem_tire_sizes || []),
          `reviewed_from_${c.sourceYear}_${c.rule}`,
        ]);
        
        console.log(`  ✅ ${c.targetYear} ${c.targetMake} ${c.targetModel}`);
        applied++;
      } catch (err: any) {
        console.log(`  ❌ ${c.targetYear} ${c.targetMake} ${c.targetModel}: ${err.message}`);
        skipped++;
      }
    }
    
    console.log('');
    console.log(`Applied: ${applied}`);
    console.log(`Skipped: ${skipped}`);
    
    // Recalculate coverage
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                         UPDATED COVERAGE');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN source LIKE 'inherited%' OR source LIKE 'reviewed%' THEN 1 END) as derived,
        COUNT(CASE WHEN source NOT LIKE 'inherited%' AND source NOT LIKE 'reviewed%' THEN 1 END) as direct
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
    `);
    
    const s = stats.rows[0];
    console.log(`Total records with bolt pattern: ${s.total}`);
    console.log(`  Direct/Manual: ${s.direct}`);
    console.log(`  Inherited: ${parseInt(s.total) - parseInt(s.direct)}`);
    
    // By source breakdown
    const bySource = await pool.query(`
      SELECT 
        CASE 
          WHEN source LIKE 'reviewed_from%' THEN 'reviewed_MEDIUM_PROMOTED'
          WHEN source LIKE 'inherited_from%SAME_GENERATION' THEN 'inherited_SAME_GENERATION'
          WHEN source LIKE 'inherited_from%SIBLING_PLATFORM' THEN 'inherited_SIBLING_PLATFORM'
          WHEN source LIKE 'inherited_from%ADJACENT_YEAR' THEN 'inherited_ADJACENT_YEAR'
          WHEN source LIKE 'inherited%' THEN 'inherited_other'
          ELSE source
        END as source_type,
        COUNT(*) as count
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      GROUP BY 1
      ORDER BY count DESC
    `);
    console.log('\nBy Source Type:');
    for (const row of bySource.rows) {
      console.log(`  ${row.source_type}: ${row.count}`);
    }
  } else if (!shouldApply) {
    console.log('Run with --apply to apply the reviewed-safe candidates');
  }

  // Write review results to file
  const outputPath = `medium-review-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalMedium: mediumCandidates.length,
    safeToPromote: safeOnes.length,
    requiresReview: unsafeOnes.length,
    safeOnes: safeOnes.map(r => ({
      target: `${r.candidate.targetYear} ${r.candidate.targetMake} ${r.candidate.targetModel}`,
      source: `${r.candidate.sourceYear} ${r.candidate.sourceMake} ${r.candidate.sourceModel}`,
      specs: r.sourceSpecs,
      notes: r.reviewNotes,
    })),
    unsafeOnes: unsafeOnes.map(r => ({
      target: `${r.candidate.targetYear} ${r.candidate.targetMake} ${r.candidate.targetModel}`,
      source: `${r.candidate.sourceYear} ${r.candidate.sourceMake} ${r.candidate.sourceModel}`,
      specs: r.sourceSpecs,
      notes: r.reviewNotes,
    })),
  }, null, 2));
  
  console.log(`\n📄 Review results written to: ${outputPath}`);
}

main().catch(console.error).finally(() => {
  pool.end();
  process.exit();
});
