import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Muscle car era: 1964-1979
const total = await client.query('SELECT COUNT(*) FROM vehicle_fitments WHERE year >= 1964 AND year <= 1979');
const byYear = await client.query('SELECT year, COUNT(*) as cnt FROM vehicle_fitments WHERE year >= 1964 AND year <= 1979 GROUP BY year ORDER BY year');

// By make
const byMake = await client.query(`
  SELECT make, COUNT(*) as cnt 
  FROM vehicle_fitments 
  WHERE year >= 1964 AND year <= 1979 
  GROUP BY make ORDER BY cnt DESC LIMIT 20
`);

// Specific muscle cars we want
const muscleList = [
  'camaro', 'chevelle', 'nova', 'corvette', 'impala', 'malibu', 'el camino',
  'mustang', 'torino', 'fairlane', 'galaxie', 'maverick', 'falcon',
  'firebird', 'gto', 'grand prix', 'lemans',
  'challenger', 'charger', 'dart', 'coronet', 'super bee',
  'barracuda', 'road runner', 'gtx', 'cuda', 'duster', 'satellite',
  '442', 'cutlass', 'toronado',
  'skylark', 'riviera', 'gran sport', 'gsx', 'gs',
  'javelin', 'amx', 'rebel'
];

const muscleModels = await client.query(`
  SELECT LOWER(make) as make, LOWER(model) as model, COUNT(*) as years, 
         MIN(year) as first_year, MAX(year) as last_year
  FROM vehicle_fitments 
  WHERE year >= 1964 AND year <= 1979 
  GROUP BY LOWER(make), LOWER(model)
  ORDER BY make, model
`);

console.log('=== MUSCLE CAR ERA (1964-1979) ===');
console.log('Total records:', total.rows[0].count);
console.log('');
console.log('By year:');
byYear.rows.forEach(r => console.log('  ' + r.year + ': ' + r.cnt));
console.log('');
console.log('By make:');
byMake.rows.forEach(r => console.log('  ' + r.make + ': ' + r.cnt));

console.log('');
console.log('=== MUSCLE CARS FOUND ===');
const found = muscleModels.rows.filter(r => muscleList.includes(r.model));
if (found.length === 0) {
  console.log('  None found!');
} else {
  found.forEach(r => console.log(`  ${r.make} ${r.model}: ${r.first_year}-${r.last_year} (${r.years} years)`));
}

console.log('');
console.log('=== MISSING MUSCLE CARS ===');
const foundModels = found.map(r => r.model);
const missing = muscleList.filter(m => !foundModels.includes(m));
console.log('  ' + missing.join(', '));

await client.end();
