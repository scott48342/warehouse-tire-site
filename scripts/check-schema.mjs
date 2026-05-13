import pg from 'pg';
const { Client } = pg;

const POSTGRES_URL = "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString: POSTGRES_URL });
  await client.connect();
  
  // Check vehicle_fitments columns
  const res1 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicle_fitments' ORDER BY ordinal_position`);
  console.log('=== vehicle_fitments columns ===');
  console.log(res1.rows.map(r => r.column_name + ' (' + r.data_type + ')').join('\n'));
  
  // Check vehicle_fitment_configurations columns  
  const res2 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicle_fitment_configurations' ORDER BY ordinal_position`);
  console.log('\n=== vehicle_fitment_configurations columns ===');
  console.log(res2.rows.map(r => r.column_name + ' (' + r.data_type + ')').join('\n'));
  
  // Sample data
  const sample1 = await client.query(`SELECT * FROM vehicle_fitments LIMIT 1`);
  console.log('\n=== Sample vehicle_fitments row ===');
  console.log(JSON.stringify(sample1.rows[0], null, 2));
  
  const sample2 = await client.query(`SELECT * FROM vehicle_fitment_configurations LIMIT 1`);
  console.log('\n=== Sample vehicle_fitment_configurations row ===');
  console.log(JSON.stringify(sample2.rows[0], null, 2));
  
  await client.end();
}

main().catch(console.error);
