import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function audit() {
  // Get all vehicles from catalog_models with their year ranges
  const catalogRes = await pool.query(`
    SELECT make_slug, name, slug, years
    FROM catalog_models
    ORDER BY make_slug, name
  `);
  
  // Expand to individual year rows, filtering to 2000-2026
  const catalogYears = [];
  for (const row of catalogRes.rows) {
    for (const year of row.years) {
      if (year >= 2000 && year <= 2026) {
        catalogYears.push({
          make: row.make_slug,
          model: row.name,
          slug: row.slug,
          year: year
        });
      }
    }
  }
  
  console.log(`Total YMM combinations in selector (2000-2026): ${catalogYears.length}`);
  
  // Get all make/model/year from vehicle_fitments
  const fitmentRes = await pool.query(`
    SELECT DISTINCT 
      LOWER(TRIM(make)) as make_norm,
      LOWER(TRIM(model)) as model_norm,
      year
    FROM vehicle_fitments
    WHERE year >= 2000 AND year <= 2026
  `);
  
  // Build a set for quick lookup - try multiple normalizations
  const fitmentSet = new Set();
  for (const row of fitmentRes.rows) {
    fitmentSet.add(`${row.make_norm}|${row.model_norm}|${row.year}`);
    // Also try with spaces replaced by hyphens and vice versa
    fitmentSet.add(`${row.make_norm}|${row.model_norm.replace(/-/g, ' ')}|${row.year}`);
    fitmentSet.add(`${row.make_norm}|${row.model_norm.replace(/ /g, '-')}|${row.year}`);
  }
  
  console.log(`Total unique fitment make/model/year (2000-2026): ${fitmentRes.rows.length}`);
  
  // Find gaps
  const gaps = [];
  for (const row of catalogYears) {
    const makeNorm = row.make.toLowerCase().trim();
    const modelNorm = row.model.toLowerCase().trim();
    
    // Check multiple variations
    const key1 = `${makeNorm}|${modelNorm}|${row.year}`;
    const key2 = `${makeNorm}|${modelNorm.replace(/-/g, ' ')}|${row.year}`;
    const key3 = `${makeNorm}|${modelNorm.replace(/ /g, '-')}|${row.year}`;
    const key4 = `${makeNorm}|${row.slug.replace(/-/g, ' ')}|${row.year}`;
    const key5 = `${makeNorm}|${row.slug}|${row.year}`;
    
    if (!fitmentSet.has(key1) && !fitmentSet.has(key2) && !fitmentSet.has(key3) && 
        !fitmentSet.has(key4) && !fitmentSet.has(key5)) {
      gaps.push({ make: row.make, model: row.model, year: row.year });
    }
  }
  
  console.log(`\nGaps found: ${gaps.length}`);
  
  // Group by make/model
  const grouped = {};
  for (const gap of gaps) {
    const key = `${gap.make}|${gap.model}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(gap.year);
  }
  
  // Sort by number of missing years
  const sorted = Object.entries(grouped)
    .map(([key, years]) => {
      const [make, model] = key.split('|');
      return { make, model, years: years.sort((a,b) => a-b), count: years.length };
    })
    .sort((a, b) => b.count - a.count);
  
  console.log('\n=== VEHICLES WITH MISSING FITMENT DATA ===\n');
  
  for (const item of sorted) {
    console.log(`${item.make} ${item.model}: ${item.count} years missing`);
    console.log(`  Missing: ${item.years.join(', ')}`);
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total vehicles in YMM (2000-2026): ${catalogYears.length}`);
  console.log(`Total with fitment data: ${catalogYears.length - gaps.length}`);
  console.log(`Total missing: ${gaps.length}`);
  console.log(`Coverage: ${((catalogYears.length - gaps.length) / catalogYears.length * 100).toFixed(2)}%`);
  
  // Save gaps to file for later processing
  fs.writeFileSync('fitment-gaps.json', JSON.stringify(sorted, null, 2));
  console.log('\nSaved to fitment-gaps.json');
  
  await pool.end();
}

audit().catch(console.error);
