// Export vehicle fitment data for Fable 5 audit
import pg from 'pg';
import fs from 'fs';

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL
});

async function main() {
  await client.connect();
  
  const output = {};
  
  // 1. Overall stats
  const stats = await client.query(`
    SELECT 
      COUNT(*)::int as total_records,
      MIN(year)::int as min_year,
      MAX(year)::int as max_year,
      COUNT(DISTINCT make)::int as unique_makes,
      COUNT(DISTINCT model)::int as unique_models,
      COUNT(DISTINCT CONCAT(year, '-', make, '-', model, '-', COALESCE(display_trim, '')))::int as unique_ymmt
    FROM vehicle_fitments
    WHERE year >= 2000
  `);
  output.overallStats = stats.rows[0];
  
  // 2. Year coverage (count by year)
  const yearCoverage = await client.query(`
    SELECT year, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY year
    ORDER BY year
  `);
  output.yearCoverage = yearCoverage.rows;
  
  // 3. Make coverage
  const makeCoverage = await client.query(`
    SELECT make, COUNT(*)::int as count, 
           MIN(year)::int as min_year, 
           MAX(year)::int as max_year
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY make
    ORDER BY count DESC
  `);
  output.makeCoverage = makeCoverage.rows;
  
  // 4. Records with missing critical data
  const missingData = await client.query(`
    SELECT 
      COUNT(*) FILTER (WHERE bolt_pattern IS NULL)::int as missing_bolt_pattern,
      COUNT(*) FILTER (WHERE center_bore_mm IS NULL)::int as missing_center_bore,
      COUNT(*) FILTER (WHERE oem_tire_sizes = '[]'::jsonb)::int as empty_tire_sizes,
      COUNT(*) FILTER (WHERE oem_wheel_sizes = '[]'::jsonb)::int as empty_wheel_sizes,
      COUNT(*) FILTER (WHERE display_trim IS NULL OR display_trim = '')::int as missing_trim
    FROM vehicle_fitments
    WHERE year >= 2000
  `);
  output.missingDataCounts = missingData.rows[0];
  
  // 5. Potential duplicates (same year/make/model/display_trim)
  const duplicates = await client.query(`
    SELECT year, make, model, display_trim, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY year, make, model, display_trim
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 50
  `);
  output.potentialDuplicates = duplicates.rows;
  
  // 6. Bolt pattern distribution
  const boltPatterns = await client.query(`
    SELECT bolt_pattern, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE year >= 2000 AND bolt_pattern IS NOT NULL
    GROUP BY bolt_pattern
    ORDER BY count DESC
  `);
  output.boltPatternDistribution = boltPatterns.rows;
  
  // 7. Sample records for structure validation
  const samples = await client.query(`
    SELECT id, year, make, model, display_trim, bolt_pattern, center_bore_mm,
           oem_tire_sizes, oem_wheel_sizes, source, quality_tier, certification_status
    FROM vehicle_fitments
    WHERE year >= 2020
    ORDER BY RANDOM()
    LIMIT 10
  `);
  output.sampleRecords = samples.rows;
  
  // 8. Quality tier distribution
  const qualityTiers = await client.query(`
    SELECT quality_tier, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY quality_tier
    ORDER BY count DESC
  `);
  output.qualityTierDistribution = qualityTiers.rows;
  
  // 9. Certification status distribution
  const certStatus = await client.query(`
    SELECT certification_status, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY certification_status
    ORDER BY count DESC
  `);
  output.certificationStatusDistribution = certStatus.rows;
  
  // 10. Source distribution
  const sources = await client.query(`
    SELECT source, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY source
    ORDER BY count DESC
  `);
  output.sourceDistribution = sources.rows;
  
  // 11. Years with potentially missing data (compare to neighbors)
  const yearGaps = await client.query(`
    WITH year_counts AS (
      SELECT year, COUNT(*)::int as count
      FROM vehicle_fitments
      WHERE year >= 2000
      GROUP BY year
    )
    SELECT y1.year, y1.count,
           LAG(y1.count) OVER (ORDER BY y1.year) as prev_year_count,
           LEAD(y1.count) OVER (ORDER BY y1.year) as next_year_count
    FROM year_counts y1
    ORDER BY y1.year
  `);
  output.yearCountComparison = yearGaps.rows;
  
  // 12. Models with only one trim (might be missing trims)
  const singleTrimModels = await client.query(`
    SELECT make, model, COUNT(DISTINCT display_trim)::int as trim_count, 
           MAX(year)::int as latest_year
    FROM vehicle_fitments
    WHERE year >= 2015
    GROUP BY make, model
    HAVING COUNT(DISTINCT display_trim) = 1
    ORDER BY make, model
    LIMIT 50
  `);
  output.singleTrimModels = singleTrimModels.rows;
  
  await client.end();
  
  // Write output
  fs.writeFileSync('scripts/fable-audit-data.json', JSON.stringify(output, null, 2));
  console.log('Audit data exported to scripts/fable-audit-data.json');
  console.log('\\n=== QUICK SUMMARY ===');
  console.log('Total records (2000+):', output.overallStats.total_records);
  console.log('Year range:', output.overallStats.min_year, '-', output.overallStats.max_year);
  console.log('Unique makes:', output.overallStats.unique_makes);
  console.log('Unique models:', output.overallStats.unique_models);
  console.log('Unique YMMT combos:', output.overallStats.unique_ymmt);
  console.log('\\n=== MISSING DATA ===');
  console.log('Missing bolt patterns:', output.missingDataCounts.missing_bolt_pattern);
  console.log('Missing center bore:', output.missingDataCounts.missing_center_bore);
  console.log('Empty tire sizes:', output.missingDataCounts.empty_tire_sizes);
  console.log('Empty wheel sizes:', output.missingDataCounts.empty_wheel_sizes);
  console.log('\\n=== DUPLICATES ===');
  console.log('Potential duplicates found:', output.potentialDuplicates.length);
  console.log('\\n=== QUALITY TIERS ===');
  output.qualityTierDistribution.forEach(t => console.log(`  ${t.quality_tier || 'null'}: ${t.count}`));
}

main().catch(console.error);
