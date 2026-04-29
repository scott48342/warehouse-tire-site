import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function check() {
  // Check catalog_models schema
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'catalog_models'
  `);
  console.log('catalog_models columns:', cols.rows.map(x => x.column_name).join(', '));
  
  // Sample row
  const sample = await pool.query('SELECT * FROM catalog_models LIMIT 3');
  console.log('\nSample rows:');
  console.log(sample.rows);
  
  await pool.end();
}

check().catch(console.error);
