import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('POSTGRES_URL not set');
  process.exit(1);
}

const client = new Client({ connectionString });

async function run() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'drizzle/migrations/0001_create_fitment_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration complete!');
    
    // Verify tables exist
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'fitment%' OR table_name LIKE 'vehicle%'
    `);
    
    console.log('\\nCreated tables:');
    for (const row of result.rows) {
      console.log(' -', row.table_name);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
