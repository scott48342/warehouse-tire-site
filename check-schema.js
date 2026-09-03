const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function checkSchema() {
  const tables = ['abandoned_carts', 'saved_quotes', 'cart_add_events'];
  
  for (const table of tables) {
    const result = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table]
    );
    console.log(`${table}:`, result.rows.map(r => r.column_name).join(', '));
  }
  
  await pool.end();
}

checkSchema().catch(console.error);
