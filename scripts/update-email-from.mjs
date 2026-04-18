import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateEmail() {
  // First, get current settings
  const { rows } = await pool.query("SELECT value FROM admin_settings WHERE key = 'email'");
  console.log('Current settings:', JSON.stringify(rows[0]?.value, null, 2));
  
  if (rows.length > 0) {
    const current = rows[0].value;
    console.log('\nOld fromEmail:', current.fromEmail);
    
    const updated = { ...current, fromEmail: 'scott@warehousetire.net' };
    
    await pool.query(
      "UPDATE admin_settings SET value = $1, updated_at = NOW() WHERE key = 'email'",
      [JSON.stringify(updated)]
    );
    
    // Verify
    const { rows: verify } = await pool.query("SELECT value FROM admin_settings WHERE key = 'email'");
    console.log('\n✓ Updated fromEmail:', verify[0]?.value?.fromEmail);
  } else {
    console.log('No email settings found in database');
  }
  
  await pool.end();
}

updateEmail().catch(e => { console.error(e); process.exit(1); });
