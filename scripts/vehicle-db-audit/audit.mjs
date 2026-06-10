/**
 * Vehicle Fitment Database Audit Script
 * 
 * READ-ONLY analysis to identify data quality issues:
 * - Rogue import batch correlation (2018 spike, unknown tier, lowercase makes)
 * - Duplicate YMMT records
 * - Missing critical fields (bolt pattern, center bore)
 * - Make normalization issues
 * - Phantom/invalid makes
 * 
 * Does NOT modify data. Generates report and CSV exports.
 * Run: node scripts/vehicle-db-audit/audit.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'results');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL
});

// Known valid makes (canonical casing) for US market
const VALID_MAKES = new Set([
  'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick',
  'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford',
  'Genesis', 'GMC', 'Honda', 'Hummer', 'Hyundai', 'Infiniti', 'Isuzu',
  'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln',
  'Lotus', 'Lucid', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mercury',
  'MINI', 'Mitsubishi', 'Nissan', 'Oldsmobile', 'Plymouth', 'Pontiac', 'Porsche',
  'Ram', 'Rivian', 'Rolls-Royce', 'Saab', 'Saturn', 'Scion', 'Subaru', 'Suzuki',
  'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
]);

// Phantom makes that should not exist
const PHANTOM_MAKES = ['Toyota Minivans', 'Nissan Vans'];

async function main() {
  console.log('='.repeat(60));
  console.log('VEHICLE FITMENT DATABASE AUDIT');
  console.log('Read-only analysis - no data will be modified');
  console.log('='.repeat(60));
  console.log(`\nTimestamp: ${new Date().toISOString()}\n`);

  await client.connect();
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {},
    issues: {},
    correlations: {},
    proposedMigration: [],
    integrityChecks: []
  };

  try {
    // ========================================
    // 1. BASELINE STATS
    // ========================================
    console.log('\n📊 BASELINE STATISTICS\n');
    
    const baselineStats = await client.query(`
      SELECT 
        COUNT(*)::int as total_records,
        COUNT(*) FILTER (WHERE year >= 2000)::int as records_2000_plus,
        MIN(year)::int as min_year,
        MAX(year)::int as max_year,
        COUNT(DISTINCT make)::int as unique_makes,
        COUNT(DISTINCT model)::int as unique_models
      FROM vehicle_fitments
    `);
    report.summary.baseline = baselineStats.rows[0];
    console.log('Total records:', report.summary.baseline.total_records);
    console.log('Records 2000+:', report.summary.baseline.records_2000_plus);
    console.log('Year range:', report.summary.baseline.min_year, '-', report.summary.baseline.max_year);
    console.log('Unique makes:', report.summary.baseline.unique_makes);
    console.log('Unique models:', report.summary.baseline.unique_models);

    // ========================================
    // 2. YEAR 2018 SPIKE ANALYSIS
    // ========================================
    console.log('\n📈 2018 SPIKE ANALYSIS\n');
    
    const yearCounts = await client.query(`
      SELECT year, COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY year
      ORDER BY year
    `);
    
    const yearMap = new Map(yearCounts.rows.map(r => [r.year, r.count]));
    const count2017 = yearMap.get(2017) || 0;
    const count2018 = yearMap.get(2018) || 0;
    const count2019 = yearMap.get(2019) || 0;
    const expectedFor2018 = Math.round((count2017 + count2019) / 2);
    const excess2018 = count2018 - expectedFor2018;
    
    report.issues.spike2018 = {
      count2017,
      count2018,
      count2019,
      expectedFor2018,
      excessRecords: excess2018,
      isAnomaly: excess2018 > expectedFor2018 * 0.5
    };
    
    console.log(`2017: ${count2017} records`);
    console.log(`2018: ${count2018} records`);
    console.log(`2019: ${count2019} records`);
    console.log(`Expected 2018 (interpolated): ~${expectedFor2018}`);
    console.log(`Excess 2018 records: ${excess2018}`);
    console.log(`Is anomaly (>50% excess): ${report.issues.spike2018.isAnomaly}`);

    // Get 2018 created_at distribution to find import batches
    const created2018 = await client.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as import_date,
        COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE year = 2018
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY count DESC
      LIMIT 10
    `);
    report.issues.spike2018.importDates = created2018.rows;
    console.log('\nTop import dates for 2018 records:');
    created2018.rows.forEach(r => console.log(`  ${r.import_date?.toISOString().split('T')[0]}: ${r.count} records`));

    // ========================================
    // 3. QUALITY TIER ANALYSIS
    // ========================================
    console.log('\n🏷️ QUALITY TIER ANALYSIS\n');
    
    const qualityTiers = await client.query(`
      SELECT 
        COALESCE(quality_tier, 'NULL') as tier,
        COUNT(*)::int as count,
        COUNT(*) FILTER (WHERE year = 2018)::int as count_2018,
        COUNT(*) FILTER (WHERE LOWER(make) = make AND make ~ '[a-z]')::int as lowercase_makes
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY quality_tier
      ORDER BY count DESC
    `);
    report.issues.qualityTiers = qualityTiers.rows;
    console.log('Tier distribution:');
    qualityTiers.rows.forEach(r => {
      console.log(`  ${r.tier}: ${r.count} total | ${r.count_2018} in 2018 | ${r.lowercase_makes} lowercase makes`);
    });

    // ========================================
    // 4. MAKE NORMALIZATION ISSUES
    // ========================================
    console.log('\n🔤 MAKE NORMALIZATION ISSUES\n');
    
    // Find all makes
    const allMakes = await client.query(`
      SELECT make, COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY make
      ORDER BY count DESC
    `);
    
    // Identify case duplicates
    const makeLower = new Map();
    const caseDuplicates = [];
    
    for (const row of allMakes.rows) {
      const lower = row.make.toLowerCase();
      if (makeLower.has(lower)) {
        caseDuplicates.push({
          canonical: makeLower.get(lower).make,
          duplicate: row.make,
          canonicalCount: makeLower.get(lower).count,
          duplicateCount: row.count
        });
      } else {
        makeLower.set(lower, row);
      }
    }
    
    // Find lowercase makes (not proper case)
    const lowercaseMakes = allMakes.rows.filter(r => 
      r.make !== r.make.charAt(0).toUpperCase() + r.make.slice(1) &&
      !['BMW', 'GMC', 'MINI', 'RAM'].includes(r.make.toUpperCase())
    );
    
    // Find phantom makes
    const phantomMakesFound = allMakes.rows.filter(r => 
      PHANTOM_MAKES.includes(r.make) || 
      r.make.includes('Minivan') || 
      r.make.includes('Vans')
    );
    
    // Find invalid makes (not in valid list)
    const invalidMakes = allMakes.rows.filter(r => 
      !VALID_MAKES.has(r.make) && 
      !caseDuplicates.some(d => d.duplicate === r.make)
    );
    
    report.issues.makeNormalization = {
      caseDuplicates,
      lowercaseMakes,
      phantomMakes: phantomMakesFound,
      invalidMakes: invalidMakes.slice(0, 20) // Top 20
    };
    
    console.log('Case duplicates found:');
    caseDuplicates.forEach(d => console.log(`  ${d.canonical} (${d.canonicalCount}) vs ${d.duplicate} (${d.duplicateCount})`));
    
    console.log('\nLowercase makes:');
    lowercaseMakes.forEach(r => console.log(`  ${r.make}: ${r.count} records`));
    
    console.log('\nPhantom/invalid makes:');
    phantomMakesFound.forEach(r => console.log(`  ${r.make}: ${r.count} records`));

    // Export lowercase make records to CSV
    const lowercaseMakeRecords = await client.query(`
      SELECT id, year, make, model, display_trim, bolt_pattern, source, quality_tier, created_at
      FROM vehicle_fitments
      WHERE year >= 2000 
        AND make IN (${lowercaseMakes.map((_, i) => `$${i + 1}`).join(',') || "''"})
      ORDER BY make, year
    `, lowercaseMakes.map(r => r.make));
    
    await exportToCSV(lowercaseMakeRecords.rows, 'lowercase-make-records.csv');
    console.log(`\nExported ${lowercaseMakeRecords.rowCount} lowercase make records to CSV`);

    // ========================================
    // 5. DUPLICATE YMMT ANALYSIS
    // ========================================
    console.log('\n🔁 DUPLICATE YMMT ANALYSIS\n');
    
    const duplicateYMMT = await client.query(`
      WITH dupes AS (
        SELECT year, make, model, display_trim, COUNT(*)::int as count
        FROM vehicle_fitments
        WHERE year >= 2000
        GROUP BY year, make, model, display_trim
        HAVING COUNT(*) > 1
      )
      SELECT 
        COUNT(*)::int as unique_duplicate_groups,
        SUM(count)::int as total_duplicate_records,
        SUM(count - 1)::int as excess_records
      FROM dupes
    `);
    report.issues.duplicates = duplicateYMMT.rows[0];
    console.log('Duplicate YMMT groups:', report.issues.duplicates.unique_duplicate_groups);
    console.log('Total records in duplicates:', report.issues.duplicates.total_duplicate_records);
    console.log('Excess (deletable) records:', report.issues.duplicates.excess_records);

    // Get sample duplicates
    const sampleDuplicates = await client.query(`
      SELECT year, make, model, display_trim, COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY year, make, model, display_trim
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 20
    `);
    report.issues.sampleDuplicates = sampleDuplicates.rows;
    console.log('\nTop duplicate YMMT combos:');
    sampleDuplicates.rows.slice(0, 10).forEach(r => 
      console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim}: ${r.count}x`)
    );

    // ========================================
    // 6. MISSING CRITICAL FIELDS
    // ========================================
    console.log('\n⚠️ MISSING CRITICAL FIELDS\n');
    
    const missingFields = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE bolt_pattern IS NULL)::int as missing_bolt_pattern,
        COUNT(*) FILTER (WHERE center_bore_mm IS NULL)::int as missing_center_bore,
        COUNT(*) FILTER (WHERE bolt_pattern IS NULL OR center_bore_mm IS NULL)::int as missing_any_wheel_field,
        COUNT(*) FILTER (WHERE oem_wheel_sizes = '[]'::jsonb)::int as empty_wheel_sizes,
        COUNT(*) FILTER (WHERE oem_tire_sizes = '[]'::jsonb)::int as empty_tire_sizes
      FROM vehicle_fitments
      WHERE year >= 2000
    `);
    report.issues.missingFields = missingFields.rows[0];
    console.log('Missing bolt pattern:', report.issues.missingFields.missing_bolt_pattern);
    console.log('Missing center bore:', report.issues.missingFields.missing_center_bore);
    console.log('Missing any wheel field:', report.issues.missingFields.missing_any_wheel_field);
    console.log('Empty wheel sizes:', report.issues.missingFields.empty_wheel_sizes);
    console.log('Empty tire sizes:', report.issues.missingFields.empty_tire_sizes);

    // Export missing field records
    const missingFieldRecords = await client.query(`
      SELECT id, year, make, model, display_trim, bolt_pattern, center_bore_mm, source, quality_tier
      FROM vehicle_fitments
      WHERE year >= 2000 
        AND (bolt_pattern IS NULL OR center_bore_mm IS NULL)
      ORDER BY year DESC, make, model
    `);
    await exportToCSV(missingFieldRecords.rows, 'missing-wheel-fields.csv');
    console.log(`Exported ${missingFieldRecords.rowCount} records with missing wheel fields to CSV`);

    // ========================================
    // 7. CORRELATION ANALYSIS (Rogue Import)
    // ========================================
    console.log('\n🔍 ROGUE IMPORT CORRELATION ANALYSIS\n');
    
    const rogueCorrelation = await client.query(`
      SELECT 
        COUNT(*)::int as total_suspect_records,
        COUNT(*) FILTER (WHERE year = 2018)::int as is_2018,
        COUNT(*) FILTER (WHERE quality_tier = 'unknown')::int as is_unknown_tier,
        COUNT(*) FILTER (WHERE LOWER(make) = make AND make ~ '[a-z]')::int as is_lowercase_make,
        COUNT(*) FILTER (WHERE bolt_pattern IS NULL OR center_bore_mm IS NULL)::int as missing_wheel_fields
      FROM vehicle_fitments
      WHERE year >= 2000
        AND (
          year = 2018
          OR quality_tier = 'unknown'
          OR (LOWER(make) = make AND make ~ '[a-z]')
          OR bolt_pattern IS NULL 
          OR center_bore_mm IS NULL
        )
    `);
    report.correlations.rogueSummary = rogueCorrelation.rows[0];
    console.log('Total suspect records (any flag):', report.correlations.rogueSummary.total_suspect_records);
    console.log('  - Is 2018:', report.correlations.rogueSummary.is_2018);
    console.log('  - Is unknown tier:', report.correlations.rogueSummary.is_unknown_tier);
    console.log('  - Is lowercase make:', report.correlations.rogueSummary.is_lowercase_make);
    console.log('  - Missing wheel fields:', report.correlations.rogueSummary.missing_wheel_fields);

    // Check overlap between flags
    const flagOverlap = await client.query(`
      SELECT 
        CASE WHEN year = 2018 THEN 1 ELSE 0 END as is_2018,
        CASE WHEN quality_tier = 'unknown' THEN 1 ELSE 0 END as is_unknown,
        CASE WHEN LOWER(make) = make AND make ~ '[a-z]' THEN 1 ELSE 0 END as is_lowercase,
        COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY 
        CASE WHEN year = 2018 THEN 1 ELSE 0 END,
        CASE WHEN quality_tier = 'unknown' THEN 1 ELSE 0 END,
        CASE WHEN LOWER(make) = make AND make ~ '[a-z]' THEN 1 ELSE 0 END
      ORDER BY count DESC
    `);
    report.correlations.flagOverlap = flagOverlap.rows;
    console.log('\nFlag overlap distribution:');
    flagOverlap.rows.forEach(r => {
      const flags = [];
      if (r.is_2018) flags.push('2018');
      if (r.is_unknown) flags.push('unknown-tier');
      if (r.is_lowercase) flags.push('lowercase');
      console.log(`  [${flags.join(', ') || 'clean'}]: ${r.count} records`);
    });

    // Find common created_at for suspect records
    const suspectImportDates = await client.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as import_date,
        COUNT(*)::int as count,
        COUNT(DISTINCT make)::int as makes,
        COUNT(DISTINCT model)::int as models
      FROM vehicle_fitments
      WHERE year >= 2000
        AND (
          quality_tier = 'unknown'
          OR (LOWER(make) = make AND make ~ '[a-z]')
        )
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY count DESC
      LIMIT 10
    `);
    report.correlations.suspectImportDates = suspectImportDates.rows;
    console.log('\nTop import dates for suspect records:');
    suspectImportDates.rows.forEach(r => 
      console.log(`  ${r.import_date?.toISOString().split('T')[0]}: ${r.count} records (${r.makes} makes, ${r.models} models)`)
    );

    // ========================================
    // 8. GENERATE PROPOSED MIGRATION PLAN
    // ========================================
    console.log('\n📋 PROPOSED MIGRATION PLAN\n');
    
    report.proposedMigration = [
      {
        step: 1,
        action: 'MAKE_CANONICALIZATION',
        description: 'Merge case-duplicate makes into canonical form',
        queries: caseDuplicates.map(d => ({
          description: `Merge "${d.duplicate}" into "${d.canonical}"`,
          sql: `UPDATE vehicle_fitments SET make = '${d.canonical}' WHERE make = '${d.duplicate}';`,
          affectedRows: d.duplicateCount
        }))
      },
      {
        step: 2,
        action: 'DELETE_PHANTOM_MAKES',
        description: 'Re-home or delete records with phantom makes (Toyota Minivans, Nissan Vans)',
        queries: phantomMakesFound.map(r => ({
          description: `Review and re-home "${r.make}" records`,
          sql: `-- Review these records first, then either re-home or delete\nSELECT * FROM vehicle_fitments WHERE make = '${r.make}';`,
          affectedRows: r.count
        }))
      },
      {
        step: 3,
        action: 'DEDUPLICATE_2018',
        description: 'Remove duplicate YMMT records, keeping highest quality',
        queries: [{
          description: 'Deduplicate by YMMT, keeping best quality_tier',
          sql: `-- Preview duplicates first
WITH ranked AS (
  SELECT id, 
    ROW_NUMBER() OVER (
      PARTITION BY year, make, model, display_trim 
      ORDER BY 
        CASE quality_tier 
          WHEN 'complete' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'partial' THEN 3 
          ELSE 4 
        END,
        created_at DESC
    ) as rn
  FROM vehicle_fitments
  WHERE year = 2018
)
SELECT COUNT(*) FROM ranked WHERE rn > 1;`,
          affectedRows: report.issues.spike2018.excessRecords
        }]
      },
      {
        step: 4,
        action: 'BACKFILL_OR_QUARANTINE_MISSING_FIELDS',
        description: 'Quarantine records missing bolt_pattern or center_bore_mm',
        queries: [{
          description: 'Mark records with missing wheel fields',
          sql: `UPDATE vehicle_fitments 
SET quality_tier = 'quarantined', 
    quarantined_at = NOW(),
    last_modified_reason = 'Missing bolt_pattern or center_bore_mm - needs backfill'
WHERE (bolt_pattern IS NULL OR center_bore_mm IS NULL)
  AND quality_tier != 'quarantined';`,
          affectedRows: report.issues.missingFields.missing_any_wheel_field
        }]
      }
    ];
    
    report.proposedMigration.forEach(step => {
      console.log(`Step ${step.step}: ${step.action}`);
      console.log(`  ${step.description}`);
      step.queries.forEach(q => console.log(`  - ${q.description} (${q.affectedRows} rows)`));
    });

    // ========================================
    // 9. INTEGRITY CHECKS FOR FUTURE IMPORTS
    // ========================================
    console.log('\n✅ INTEGRITY CHECKS FOR FUTURE IMPORTS\n');
    
    report.integrityChecks = [
      {
        name: 'no_lowercase_makes',
        description: 'Reject imports with lowercase makes',
        check: `SELECT COUNT(*) FROM vehicle_fitments WHERE LOWER(make) = make AND make ~ '[a-z]'`,
        threshold: 0
      },
      {
        name: 'no_phantom_makes',
        description: 'Reject imports with phantom makes (Toyota Minivans, etc.)',
        check: `SELECT COUNT(*) FROM vehicle_fitments WHERE make IN ('Toyota Minivans', 'Nissan Vans')`,
        threshold: 0
      },
      {
        name: 'no_missing_wheel_fields',
        description: 'Warn if records missing bolt_pattern or center_bore_mm',
        check: `SELECT COUNT(*) FROM vehicle_fitments WHERE bolt_pattern IS NULL OR center_bore_mm IS NULL`,
        threshold: 100 // Allow some, but flag high counts
      },
      {
        name: 'no_year_spikes',
        description: 'Alert if any year has >1.5x records of neighboring years',
        check: `WITH yc AS (
  SELECT year, COUNT(*) as c FROM vehicle_fitments GROUP BY year
)
SELECT year FROM yc y1
WHERE y1.c > 1.5 * (
  SELECT AVG(c) FROM yc y2 WHERE y2.year BETWEEN y1.year - 1 AND y1.year + 1 AND y2.year != y1.year
)`,
        threshold: 0
      },
      {
        name: 'no_duplicate_ymmt',
        description: 'Reject imports that create YMMT duplicates',
        check: `SELECT COUNT(*) FROM (
  SELECT year, make, model, display_trim FROM vehicle_fitments GROUP BY 1,2,3,4 HAVING COUNT(*) > 1
) d`,
        threshold: 0
      }
    ];
    
    report.integrityChecks.forEach(check => {
      console.log(`- ${check.name}: ${check.description} (threshold: ${check.threshold})`);
    });

    // ========================================
    // 10. EXPORT FULL REPORT
    // ========================================
    const reportPath = path.join(OUTPUT_DIR, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📁 Full report exported to: ${reportPath}`);

    // Generate markdown summary
    await generateMarkdownReport(report);

  } finally {
    await client.end();
  }
}

async function exportToCSV(rows, filename) {
  if (rows.length === 0) return;
  
  const filepath = path.join(OUTPUT_DIR, filename);
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(','))
  ].join('\n');
  
  fs.writeFileSync(filepath, csv);
}

async function generateMarkdownReport(report) {
  const md = `# Vehicle Fitment Database Audit Report

**Generated:** ${report.timestamp}

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Records (2000+) | ${report.summary.baseline.records_2000_plus.toLocaleString()} |
| Unique Makes | ${report.summary.baseline.unique_makes} |
| Unique Models | ${report.summary.baseline.unique_models} |
| 2018 Excess Records | ${report.issues.spike2018.excessRecords.toLocaleString()} |
| Case-Duplicate Makes | ${report.issues.makeNormalization.caseDuplicates.length} |
| Lowercase Make Records | ${report.issues.makeNormalization.lowercaseMakes.reduce((a, b) => a + b.count, 0)} |
| Duplicate YMMT Groups | ${report.issues.duplicates.unique_duplicate_groups} |
| Missing Wheel Fields | ${report.issues.missingFields.missing_any_wheel_field} |

## Issues Found

### 1. 2018 Year Spike 🚨
- Expected records: ~${report.issues.spike2018.expectedFor2018.toLocaleString()}
- Actual records: ${report.issues.spike2018.count2018.toLocaleString()}
- Excess: ${report.issues.spike2018.excessRecords.toLocaleString()} (${Math.round(report.issues.spike2018.excessRecords / report.issues.spike2018.expectedFor2018 * 100)}% above expected)
- **Likely cause:** Import artifact / duplicate batch

### 2. Make Normalization
${report.issues.makeNormalization.caseDuplicates.map(d => 
  `- "${d.duplicate}" (${d.duplicateCount}) should merge into "${d.canonical}" (${d.canonicalCount})`
).join('\n')}

### 3. Phantom Makes
${report.issues.makeNormalization.phantomMakes.map(r => 
  `- "${r.make}": ${r.count} records (should be re-homed or deleted)`
).join('\n') || '- None found'}

### 4. Missing Critical Fields
- Missing bolt pattern: ${report.issues.missingFields.missing_bolt_pattern}
- Missing center bore: ${report.issues.missingFields.missing_center_bore}
- **Impact:** These records cannot safely be used for wheel fitment

## Correlation Analysis

The following flags often appear together, suggesting a single rogue import batch:
${report.correlations.flagOverlap.map(r => {
  const flags = [];
  if (r.is_2018) flags.push('2018');
  if (r.is_unknown) flags.push('unknown-tier');
  if (r.is_lowercase) flags.push('lowercase');
  return `- [${flags.join(', ') || 'clean'}]: ${r.count.toLocaleString()} records`;
}).join('\n')}

## Proposed Migration Steps

${report.proposedMigration.map(step => `
### Step ${step.step}: ${step.action}
${step.description}
${step.queries.map(q => `- ${q.description} (~${q.affectedRows} rows)`).join('\n')}
`).join('\n')}

## Integrity Checks (For Future Imports)

${report.integrityChecks.map(c => `- **${c.name}**: ${c.description}`).join('\n')}

---

**⚠️ NO DATA HAS BEEN MODIFIED. Review this report and approve before running migrations.**
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'AUDIT-REPORT.md'), md);
  console.log(`📝 Markdown report: ${path.join(OUTPUT_DIR, 'AUDIT-REPORT.md')}`);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
