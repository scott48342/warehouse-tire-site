import pg from 'pg';
const { Client } = pg;

const POSTGRES_URL = "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

const client = new Client({ connectionString: POSTGRES_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments'
  ORDER BY ordinal_position
`);

console.log('vehicle_fitments columns:');
rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

await client.end();
