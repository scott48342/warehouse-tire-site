import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });
const { Pool } = pg;

const url = process.env.POSTGRES_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url?.includes('neon') || url?.includes('prisma') ? { rejectUnauthorized: false } : undefined
});

async function main() {
  // Check what tables exist
  console.log('=== Tables with "order" in name ===');
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name ILIKE '%order%' OR table_name = 'quotes')
  `);
  for (const t of tables.rows) {
    console.log(t.table_name);
  }

  // Check quotes table for paid orders (might have a status field)
  console.log('\n=== Quotes table columns ===');
  const schema = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'quotes'
    ORDER BY ordinal_position
  `);
  for (const col of schema.rows) {
    console.log(`${col.column_name}: ${col.data_type}`);
  }

  // Check if there's a stripe_payments or similar table
  console.log('\n=== Payment/Stripe tables ===');
  const paymentTables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name ILIKE '%stripe%' OR table_name ILIKE '%payment%')
  `);
  for (const t of paymentTables.rows) {
    console.log(t.table_name);
    // Get columns
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = $1
    `, [t.table_name]);
    console.log('  columns:', cols.rows.map(c => c.column_name).join(', '));
  }

  await pool.end();
}

main().catch(console.error);
