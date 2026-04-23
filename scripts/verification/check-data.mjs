import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// Check Astro
console.log('=== ASTRO ===');
const astro = await client.query(`
  SELECT year, model, bolt_pattern, center_bore_mm 
  FROM vehicle_fitments 
  WHERE model ILIKE '%astro%' 
  LIMIT 10
`);
console.log(`Found ${astro.rowCount} Astro records`);
if (astro.rows.length) console.table(astro.rows);

// Check S10
console.log('\n=== S10 ===');
const s10 = await client.query(`
  SELECT year, model, bolt_pattern, center_bore_mm 
  FROM vehicle_fitments 
  WHERE model ILIKE '%s10%' 
  LIMIT 10
`);
console.log(`Found ${s10.rowCount} S10 records`);
if (s10.rows.length) console.table(s10.rows);

// Check Camaro vintage
console.log('\n=== VINTAGE CAMARO ===');
const camaro = await client.query(`
  SELECT year, model, bolt_pattern, oem_tire_sizes 
  FROM vehicle_fitments 
  WHERE model ILIKE '%camaro%' AND year < 1982
  LIMIT 10
`);
console.log(`Found ${camaro.rowCount} vintage Camaro records`);
if (camaro.rows.length) console.table(camaro.rows);

// Check what makes/models we have
console.log('\n=== MAKES/MODELS COUNT ===');
const counts = await client.query(`
  SELECT make, model, COUNT(*) as cnt 
  FROM vehicle_fitments 
  GROUP BY make, model 
  ORDER BY cnt DESC 
  LIMIT 20
`);
console.table(counts.rows);

// Total count
const total = await client.query('SELECT COUNT(*) FROM vehicle_fitments');
console.log(`\nTotal records in vehicle_fitments: ${total.rows[0].count}`);

await client.end();
