const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Top 100 most popular vehicles in the US (should all be in database)
const popularVehicles = [
  // Trucks
  ['ford', 'f-150'], ['chevrolet', 'silverado-1500'], ['ram', '1500'],
  ['toyota', 'tacoma'], ['toyota', 'tundra'], ['nissan', 'titan'],
  ['gmc', 'sierra-1500'], ['ford', 'ranger'], ['chevrolet', 'colorado'],
  ['nissan', 'frontier'], ['honda', 'ridgeline'],
  
  // SUVs - Compact
  ['toyota', 'rav4'], ['honda', 'cr-v'], ['nissan', 'rogue'],
  ['chevrolet', 'equinox'], ['ford', 'escape'], ['mazda', 'cx-5'],
  ['subaru', 'forester'], ['hyundai', 'tucson'], ['kia', 'sportage'],
  ['jeep', 'compass'], ['jeep', 'renegade'], ['volkswagen', 'tiguan'],
  
  // SUVs - Mid/Full
  ['ford', 'explorer'], ['chevrolet', 'traverse'], ['toyota', 'highlander'],
  ['honda', 'pilot'], ['jeep', 'grand-cherokee'], ['dodge', 'durango'],
  ['chevrolet', 'tahoe'], ['ford', 'expedition'], ['gmc', 'yukon'],
  ['nissan', 'pathfinder'], ['nissan', 'murano'], ['subaru', 'outback'],
  ['hyundai', 'santa-fe'], ['kia', 'sorento'], ['mazda', 'cx-9'],
  
  // SUVs - Classic/Off-road
  ['jeep', 'wrangler'], ['jeep', 'cherokee'], ['jeep', 'liberty'],
  ['ford', 'bronco'], ['chevrolet', 'blazer'], ['chevrolet', 'trailblazer'],
  ['toyota', '4runner'], ['toyota', 'land-cruiser'], ['nissan', 'xterra'],
  ['cadillac', 'escalade'], ['lincoln', 'navigator'],
  
  // Sedans
  ['toyota', 'camry'], ['honda', 'accord'], ['toyota', 'corolla'],
  ['honda', 'civic'], ['nissan', 'altima'], ['hyundai', 'sonata'],
  ['kia', 'optima'], ['ford', 'fusion'], ['chevrolet', 'malibu'],
  ['nissan', 'sentra'], ['hyundai', 'elantra'], ['kia', 'forte'],
  ['mazda', 'mazda3'], ['mazda', 'mazda6'], ['subaru', 'legacy'],
  ['volkswagen', 'jetta'], ['volkswagen', 'passat'], ['nissan', 'maxima'],
  ['toyota', 'avalon'], ['chrysler', '300'],
  
  // Compact/Subcompact
  ['toyota', 'yaris'], ['honda', 'fit'], ['hyundai', 'accent'],
  ['kia', 'rio'], ['nissan', 'versa'], ['chevrolet', 'spark'],
  ['mitsubishi', 'mirage'], ['ford', 'fiesta'], ['ford', 'focus'],
  
  // Sports
  ['ford', 'mustang'], ['chevrolet', 'camaro'], ['dodge', 'challenger'],
  ['dodge', 'charger'], ['chevrolet', 'corvette'], ['nissan', '370z'],
  ['mazda', 'mx-5-miata'], ['toyota', 'supra'], ['subaru', 'wrx'],
  ['subaru', 'brz'], ['toyota', 'gr86'],
  
  // Minivans
  ['honda', 'odyssey'], ['toyota', 'sienna'], ['chrysler', 'pacifica'],
  ['chrysler', 'town-and-country'], ['kia', 'sedona'], ['kia', 'carnival'],
  ['dodge', 'grand-caravan'],
  
  // EVs
  ['tesla', 'model-3'], ['tesla', 'model-y'], ['tesla', 'model-s'],
  ['chevrolet', 'bolt-ev'], ['ford', 'f-150-lightning'], ['ford', 'mustang-mach-e'],
  ['hyundai', 'ioniq'], ['kia', 'ev6'], ['rivian', 'r1t'],
  
  // Hybrids
  ['toyota', 'prius'], ['honda', 'insight'], ['hyundai', 'ioniq-hybrid'],
];

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== CHECKING POPULAR VEHICLES ===\n');
  
  const missing = [];
  const sparse = [];
  
  for (const [make, model] of popularVehicles) {
    const res = await pool.query(
      'SELECT MIN(year) as min_yr, MAX(year) as max_yr, COUNT(DISTINCT year) as cnt FROM vehicle_fitments WHERE make = $1 AND model = $2',
      [make, model]
    );
    
    const row = res.rows[0];
    if (!row.cnt || row.cnt === '0' || row.cnt === 0) {
      missing.push(`${make} ${model}`);
    } else if (parseInt(row.cnt) < 5) {
      sparse.push(`${make} ${model}: ${row.min_yr}-${row.max_yr} (${row.cnt} years)`);
    }
  }
  
  if (missing.length > 0) {
    console.log('❌ MISSING ENTIRELY (' + missing.length + '):');
    missing.forEach(v => console.log('  ' + v));
  } else {
    console.log('✅ All popular vehicles exist in database');
  }
  
  if (sparse.length > 0) {
    console.log('\n⚠️ SPARSE COVERAGE (<5 years):');
    sparse.forEach(v => console.log('  ' + v));
  }
  
  // Check all Jeep models specifically
  console.log('\n=== ALL JEEP MODELS ===');
  const jeeps = await pool.query(`
    SELECT model, MIN(year) as min_yr, MAX(year) as max_yr, COUNT(DISTINCT year) as cnt 
    FROM vehicle_fitments WHERE make = 'jeep' GROUP BY model ORDER BY model
  `);
  jeeps.rows.forEach(r => console.log(`  ${r.model}: ${r.min_yr}-${r.max_yr} (${r.cnt} years)`));
  
  await pool.end();
}

check();
