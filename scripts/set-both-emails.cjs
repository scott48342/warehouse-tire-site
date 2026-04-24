const pg = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const { rows } = await pool.query(`SELECT value FROM admin_settings WHERE key = 'email' LIMIT 1`);
  const current = rows[0].value;
  
  const newSettings = {
    ...current,
    notifyEmail: 'scott@warehousetire.net, 2484990359@tmomail.net'
  };
  
  await pool.query(`UPDATE admin_settings SET value = $1 WHERE key = 'email'`, [JSON.stringify(newSettings)]);
  
  console.log('✅ Updated notifyEmail to BOTH:');
  console.log('   📧 scott@warehousetire.net (email)');
  console.log('   📱 2484990359@tmomail.net (text)');
}

main().finally(() => pool.end());
