import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// Get schema
const schema = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments' 
  ORDER BY ordinal_position
`);
console.log('vehicle_fitments schema:');
schema.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

// Sample row
const sample = await client.query('SELECT * FROM vehicle_fitments LIMIT 1');
console.log('\nSample row:');
console.log(JSON.stringify(sample.rows[0], null, 2));

// Check for Astro records
const astro = await client.query(`
  SELECT id, year, make, model, bolt_pattern, hub_bore 
  FROM vehicle_fitments 
  WHERE model ILIKE '%astro%' 
  LIMIT 5
`);
console.log('\nAstro records:');
console.log(astro.rows);

// Check for Camaro records
const camaro = await client.query(`
  SELECT id, year, make, model, tire_sizes 
  FROM vehicle_fitments 
  WHERE model ILIKE '%camaro%' AND year < 1980
  LIMIT 5
`);
console.log('\nVintage Camaro records:');
console.log(camaro.rows);

await client.end();
