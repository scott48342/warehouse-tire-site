import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log('=== RECORDS BY SOURCE ===');
const sources = await client.query(`
  SELECT source, COUNT(*)::int as count 
  FROM vehicle_fitments 
  GROUP BY source 
  ORDER BY count DESC
`);
sources.rows.forEach(s => console.log(`${s.source}: ${s.count}`));

console.log('\n=== UNVERIFIED TOTAL ===');
const unverified = await client.query(`
  SELECT COUNT(*)::int as count 
  FROM vehicle_fitments 
  WHERE source != 'verified-research'
`);
console.log('To verify:', unverified.rows[0].count);

console.log('\n=== MAKES TO VERIFY ===');
const makes = await client.query(`
  SELECT make, COUNT(*)::int as count 
  FROM vehicle_fitments 
  WHERE source != 'verified-research'
  GROUP BY make 
  ORDER BY count DESC
`);
makes.rows.forEach(m => console.log(`${m.make}: ${m.count}`));

console.log('\n=== SAMPLE RECORD ===');
const sample = await client.query(`SELECT * FROM vehicle_fitments LIMIT 1`);
console.log('Fields:', Object.keys(sample.rows[0]).join(', '));

await client.end();
