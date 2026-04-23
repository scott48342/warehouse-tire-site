import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const client = await pool.connect();
  
  try {
    // List all tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'catalog%'
      ORDER BY table_name
    `);
    
    console.log('Catalog tables:');
    tables.rows.forEach(r => console.log('  ' + r.table_name));
    
    // Check catalog_models columns
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'catalog_models'
      ORDER BY ordinal_position
    `);
    
    console.log('\ncatalog_models columns:');
    cols.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));
    
    // Sample data
    const sample = await client.query(`
      SELECT * FROM catalog_models LIMIT 3
    `);
    
    console.log('\nSample catalog_models:');
    console.log(JSON.stringify(sample.rows, null, 2));
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
