import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Check current connections
  const { rows: current } = await pool.query('SELECT * FROM tireweb_connections');
  console.log('Current connections:');
  console.log(JSON.stringify(current, null, 2));
  
  // Ensure connections exist and are enabled
  const connections = [
    { provider: 'tireweb_atd', connection_id: 488677 },
    { provider: 'tireweb_ntw', connection_id: 488546 },
    { provider: 'tireweb_usautoforce', connection_id: 488548 },
  ];
  
  for (const conn of connections) {
    await pool.query(`
      INSERT INTO tireweb_connections (provider, connection_id, enabled)
      VALUES ($1, $2, true)
      ON CONFLICT (provider) DO UPDATE SET 
        connection_id = $2,
        enabled = true
    `, [conn.provider, conn.connection_id]);
    console.log(`✓ Enabled ${conn.provider} (${conn.connection_id})`);
  }
  
  // Verify
  const { rows: after } = await pool.query('SELECT * FROM tireweb_connections WHERE enabled = true');
  console.log('\nEnabled connections after fix:', after.length);
  
} catch (err) {
  console.error('Error:', err);
} finally {
  await pool.end();
}
