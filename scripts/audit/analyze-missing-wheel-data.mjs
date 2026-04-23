import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log('=== WHEEL DATA GAP ANALYSIS ===\n');

// 1. By source - where are the gaps?
const bySource = await client.query(`
  SELECT 
    source,
    COUNT(*)::int as total,
    SUM(CASE WHEN quality_tier = 'complete' THEN 1 ELSE 0 END)::int as complete,
    SUM(CASE WHEN quality_tier != 'complete' THEN 1 ELSE 0 END)::int as incomplete
  FROM vehicle_fitments
  WHERE year >= 2000
  GROUP BY source
  ORDER BY incomplete DESC
`);

console.log('BY SOURCE:');
console.table(bySource.rows);

// 2. Can we inherit from adjacent years?
const inheritAnalysis = await client.query(`
  WITH incomplete AS (
    SELECT DISTINCT year, make, model 
    FROM vehicle_fitments 
    WHERE quality_tier != 'complete' AND year >= 2000
  ),
  has_complete AS (
    SELECT DISTINCT make, model
    FROM vehicle_fitments 
    WHERE quality_tier = 'complete' AND year >= 2000
  )
  SELECT 
    (SELECT COUNT(*) FROM incomplete) as total_incomplete_ymm,
    COUNT(*) as can_inherit_from_same_model
  FROM incomplete i
  WHERE EXISTS (
    SELECT 1 FROM has_complete h 
    WHERE h.make = i.make AND h.model = i.model
  )
`);

console.log('\nINHERITANCE POTENTIAL:');
console.log(inheritAnalysis.rows[0]);

// 3. What can't be inherited?
const noInherit = await client.query(`
  WITH incomplete AS (
    SELECT DISTINCT year, make, model 
    FROM vehicle_fitments 
    WHERE quality_tier != 'complete' AND year >= 2000
  ),
  has_complete AS (
    SELECT DISTINCT make, model
    FROM vehicle_fitments 
    WHERE quality_tier = 'complete' AND year >= 2000
  )
  SELECT i.make, COUNT(DISTINCT i.model) as models_without_any_complete
  FROM incomplete i
  WHERE NOT EXISTS (
    SELECT 1 FROM has_complete h 
    WHERE h.make = i.make AND h.model = i.model
  )
  GROUP BY i.make
  ORDER BY models_without_any_complete DESC
  LIMIT 15
`);

console.log('\nMAKES WITH MODELS HAVING NO COMPLETE DATA AT ALL:');
console.table(noInherit.rows);

// 4. Example vehicles that CAN inherit
const canInheritExamples = await client.query(`
  WITH incomplete AS (
    SELECT year, make, model, trim
    FROM vehicle_fitments 
    WHERE quality_tier != 'complete' AND year >= 2000
    LIMIT 1000
  ),
  complete_source AS (
    SELECT make, model, year as source_year, 
           oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE quality_tier = 'complete' AND year >= 2000
  )
  SELECT DISTINCT ON (i.make, i.model)
    i.year, i.make, i.model,
    c.source_year as can_copy_from_year,
    c.oem_wheel_sizes::text as wheel_data_available
  FROM incomplete i
  JOIN complete_source c ON i.make = c.make AND i.model = c.model
  ORDER BY i.make, i.model, ABS(i.year - c.source_year)
  LIMIT 20
`);

console.log('\nEXAMPLES - INCOMPLETE VEHICLES THAT CAN INHERIT:');
console.table(canInheritExamples.rows.map(r => ({
  year: r.year,
  make: r.make, 
  model: r.model,
  copy_from: r.can_copy_from_year,
  has_data: r.wheel_data_available && r.wheel_data_available !== '[]' ? 'YES' : 'NO'
})));

// 5. Summary
const summary = await client.query(`
  SELECT 
    COUNT(*) FILTER (WHERE quality_tier = 'complete')::int as complete,
    COUNT(*) FILTER (WHERE quality_tier = 'partial')::int as partial,
    COUNT(*) FILTER (WHERE quality_tier = 'low_confidence')::int as low_confidence,
    COUNT(*)::int as total
  FROM vehicle_fitments
  WHERE year >= 2000
`);

console.log('\n=== SUMMARY ===');
console.log(summary.rows[0]);

await client.end();
