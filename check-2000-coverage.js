const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const KNOWN_MULTI_TRIM_MODELS = new Set([
  'mustang', 'camaro', 'challenger', 'charger', 'corvette', 'gt-r', 'supra',
  '370z', '350z', 'brz', '86', 'gr86', 'wrx', 'sti', 'civic-type-r', 'civic-si',
  'golf-r', 'golf-gti', 'm3', 'm4', 'm5', 'c63', 'amg-gt', 'rs3', 'rs5', 'rs7',
  'f-150', 'f-250', 'f-350', 'f-250-super-duty', 'f-350-super-duty',
  'silverado-1500', 'silverado-2500', 'silverado-2500hd', 'silverado-3500',
  'ram-1500', 'ram-2500', 'ram-3500', '1500', '2500', '3500',
  'sierra-1500', 'sierra-2500', 'sierra-2500hd', 'sierra-3500',
  'tundra', 'titan', 'titan-xd', 'wrangler', 'grand-cherokee', 'bronco',
  '4runner', 'tacoma', '3-series', '5-series', 'c-class', 'e-class', 
  's-class', 'a4', 'a6', 's4', 's6', '300', '300c',
]);

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Get all Y/M/M for 2000+ with trim counts
  const result = await pool.query(`
    SELECT year, make, model, COUNT(DISTINCT display_trim) as trim_count,
           array_agg(DISTINCT display_trim ORDER BY display_trim) as trims
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY year, make, model
    ORDER BY make, model, year DESC
  `);

  // Find gaps (known multi-trim with only 1 trim or only Base)
  const gaps = [];
  for (const row of result.rows) {
    const isKnownMulti = KNOWN_MULTI_TRIM_MODELS.has(row.model.toLowerCase());
    const hasOnlyBase = row.trim_count === 1 && row.trims[0] === 'Base';
    const hasSingleTrim = row.trim_count === 1;
    
    if (isKnownMulti && (hasOnlyBase || hasSingleTrim)) {
      gaps.push({
        year: row.year,
        make: row.make,
        model: row.model,
        trimCount: row.trim_count,
        trims: row.trims
      });
    }
  }

  console.log('='.repeat(60));
  console.log('2000+ COVERAGE GAPS (known multi-trim with single trim)');
  console.log('='.repeat(60));
  
  if (gaps.length === 0) {
    console.log('\n✅ NO GAPS - All known multi-trim models have multiple trims!\n');
  } else {
    // Group by make/model
    const grouped = {};
    for (const g of gaps) {
      const key = `${g.make}/${g.model}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(g.year);
    }
    
    console.log(`\n❌ ${gaps.length} Y/M/M combinations with gaps:\n`);
    for (const [key, years] of Object.entries(grouped).sort()) {
      console.log(`  ${key}: ${years.length} years [${Math.min(...years)}-${Math.max(...years)}]`);
    }
  }

  // Summary of multi-trim coverage
  const multiTrimModels = result.rows.filter(r => KNOWN_MULTI_TRIM_MODELS.has(r.model.toLowerCase()));
  const complete = multiTrimModels.filter(r => r.trim_count > 1);
  const incomplete = multiTrimModels.filter(r => r.trim_count <= 1);
  
  console.log('\n' + '─'.repeat(60));
  console.log('SUMMARY (2000-2026, known multi-trim models only)');
  console.log('─'.repeat(60));
  console.log(`Complete (2+ trims): ${complete.length}`);
  console.log(`Incomplete (1 trim): ${incomplete.length}`);
  console.log(`Coverage: ${(complete.length / multiTrimModels.length * 100).toFixed(1)}%`);

  await pool.end();
}

main().catch(console.error);
