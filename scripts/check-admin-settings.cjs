const pg = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Check if table exists
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%setting%'
  `);
  console.log('Tables with "setting" in name:', tables.map(t => t.table_name));
  
  // Get all admin_settings
  try {
    const { rows } = await pool.query(`SELECT * FROM admin_settings`);
    console.log('\n=== ADMIN SETTINGS ===');
    rows.forEach(row => {
      console.log(`Key: ${row.key}`);
      console.log(`Value: ${JSON.stringify(row.value, null, 2).slice(0, 200)}...`);
      console.log('---');
    });
    console.log(`Total: ${rows.length} settings`);
  } catch (err) {
    console.log('Error querying admin_settings:', err.message);
  }
}

main().finally(() => pool.end());
