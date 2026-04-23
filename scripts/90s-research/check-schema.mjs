import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const res = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments' 
  ORDER BY ordinal_position
`);

console.log('Columns:');
res.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));

await client.end();
