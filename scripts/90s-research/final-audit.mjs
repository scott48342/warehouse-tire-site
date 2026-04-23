import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const total = await client.query('SELECT COUNT(*) FROM vehicle_fitments WHERE year >= 1990 AND year <= 1999');
const unique = await client.query('SELECT COUNT(DISTINCT (year, LOWER(make), LOWER(model))) FROM vehicle_fitments WHERE year >= 1990 AND year <= 1999');

console.log('=== FINAL 90s COVERAGE ===');
console.log('Total records:', total.rows[0].count);
console.log('Unique YMM (case-insensitive):', unique.rows[0].count);

// Check gap makes after normalization
const gapMakes = ['Plymouth', 'Saturn', 'Saab', 'Suzuki', 'Isuzu', 'Daewoo', 'Hummer'];
console.log('\nGap makes coverage:');
for (const make of gapMakes) {
  const res = await client.query(
    'SELECT COUNT(*) FROM vehicle_fitments WHERE year >= 1990 AND year <= 1999 AND LOWER(make) = $1',
    [make.toLowerCase()]
  );
  console.log(`  ${make}: ${res.rows[0].count}`);
}

// Compare to start
console.log('\n=== BEFORE/AFTER ===');
console.log('Started with: 1,524 records (717 unique YMM)');
console.log('Now have:', total.rows[0].count, 'records (' + unique.rows[0].count + ' unique YMM)');
console.log('Added:', parseInt(total.rows[0].count) - 1524, 'records');

await client.end();
