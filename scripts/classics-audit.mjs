import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Check 1950s and early 60s (pre-muscle)
const fifties = await client.query('SELECT COUNT(*) FROM vehicle_fitments WHERE year >= 1950 AND year <= 1963');
const byYear = await client.query('SELECT year, COUNT(*) as cnt FROM vehicle_fitments WHERE year >= 1950 AND year <= 1963 GROUP BY year ORDER BY year');

console.log('=== PRE-MUSCLE ERA (1950-1963) ===');
console.log('Total:', fifties.rows[0].count);
byYear.rows.forEach(r => console.log('  ' + r.year + ': ' + r.cnt));

// Classic show car checklist
const showCarList = [
  // Tri-Five Chevy
  ['chevrolet', 'bel air'], ['chevrolet', '210'], ['chevrolet', '150'],
  // 50s-60s Chevy
  ['chevrolet', 'impala'], ['chevrolet', 'corvette'], ['chevrolet', 'nomad'],
  // Ford
  ['ford', 'thunderbird'], ['ford', 'fairlane'], ['ford', 'galaxie'], ['ford', 'f-100'],
  // Cadillac
  ['cadillac', 'deville'], ['cadillac', 'eldorado'], ['cadillac', 'fleetwood'], ['cadillac', 'coupe deville'],
  // Pontiac
  ['pontiac', 'bonneville'], ['pontiac', 'catalina'], ['pontiac', 'gto'],
  // Buick
  ['buick', 'riviera'], ['buick', 'skylark'], ['buick', 'roadmaster'],
  // Oldsmobile
  ['oldsmobile', '88'], ['oldsmobile', '98'], ['oldsmobile', 'cutlass'],
  // Dodge/Plymouth
  ['dodge', 'charger'], ['plymouth', 'fury'], ['plymouth', 'barracuda'],
  // Trucks
  ['chevrolet', 'c10'], ['chevrolet', 'c-10'], ['ford', 'f100'], ['ford', 'f-100']
];

console.log('');
console.log('=== CLASSIC SHOW CAR CHECKLIST ===');
for (const [make, model] of showCarList) {
  const res = await client.query(
    `SELECT MIN(year) as first, MAX(year) as last, COUNT(*) as cnt 
     FROM vehicle_fitments 
     WHERE LOWER(make) = $1 AND LOWER(model) = $2`,
    [make, model]
  );
  const r = res.rows[0];
  if (r.cnt > 0) {
    console.log(`✅ ${make} ${model}: ${r.first}-${r.last} (${r.cnt} years)`);
  } else {
    console.log(`❌ ${make} ${model}: MISSING`);
  }
}

// Total coverage by decade
console.log('');
console.log('=== COVERAGE BY DECADE ===');
const decades = await client.query(`
  SELECT 
    FLOOR(year/10)*10 as decade,
    COUNT(*) as records,
    COUNT(DISTINCT (year, LOWER(make), LOWER(model))) as unique_ymm
  FROM vehicle_fitments
  WHERE year >= 1950 AND year <= 1989
  GROUP BY FLOOR(year/10)*10
  ORDER BY decade
`);
decades.rows.forEach(r => console.log(`  ${r.decade}s: ${r.records} records, ${r.unique_ymm} unique YMM`));

await client.end();
