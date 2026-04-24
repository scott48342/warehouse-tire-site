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
  // Get current settings
  const { rows } = await pool.query(
    `SELECT value FROM admin_settings WHERE key = 'email' LIMIT 1`
  );
  
  if (!rows.length) {
    console.log('No email settings found.');
    return;
  }
  
  const current = rows[0].value;
  console.log('Current settings:');
  console.log('  Enabled:', current.enabled);
  console.log('  SMTP Host:', current.smtpHost);
  console.log('  From Email:', current.fromEmail);
  console.log('  Notify Email:', current.notifyEmail || '(not set)');
  console.log('');
  
  // Update notifyEmail
  const newSettings = {
    ...current,
    notifyEmail: '2484990359@tmomail.net'
  };
  
  await pool.query(
    `UPDATE admin_settings SET value = $1, updated_at = NOW() WHERE key = 'email'`,
    [JSON.stringify(newSettings)]
  );
  
  console.log('✅ Updated notifyEmail to: 2484990359@tmomail.net');
  console.log('');
  console.log('You will now receive TEXT alerts when carts ($200+) are abandoned!');
}

main().finally(() => pool.end());
