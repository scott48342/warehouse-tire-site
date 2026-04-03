import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // Check tireweb_config
    const config = await pool.query('SELECT key, LEFT(value, 30) as value_preview FROM tireweb_config');
    console.log('\n=== tireweb_config ===');
    console.log(config.rows);
    
    // Check tireweb_connections
    const conns = await pool.query('SELECT * FROM tireweb_connections');
    console.log('\n=== tireweb_connections ===');
    console.log(conns.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
