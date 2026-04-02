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
  
  const result = await pool.query(`
    SELECT year, make, model, COUNT(DISTINCT display_trim) as trim_count,
           array_agg(DISTINCT display_trim ORDER BY display_trim) as trims
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY year, make, model
    HAVING COUNT(DISTINCT display_trim) = 1
    ORDER BY make, model, year DESC
  `);

  const incomplete = result.rows.filter(r => KNOWN_MULTI_TRIM_MODELS.has(r.model.toLowerCase()));
  
  console.log('Incomplete known multi-trim models (2000+):');
  console.log('='.repeat(60));
  
  // Group by make/model
  const grouped = {};
  for (const r of incomplete) {
    const key = `${r.make}/${r.model}`;
    if (!grouped[key]) grouped[key] = { years: [], trims: new Set() };
    grouped[key].years.push(r.year);
    grouped[key].trims.add(r.trims[0]);
  }
  
  for (const [key, data] of Object.entries(grouped).sort()) {
    const years = data.years.sort((a,b) => b-a);
    console.log(`\n${key}`);
    console.log(`  Years: ${years.join(', ')}`);
    console.log(`  Trims: ${[...data.trims].join(', ')}`);
  }

  await pool.end();
}

main().catch(console.error);
