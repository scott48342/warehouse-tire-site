const { Pool } = require('pg');
const fs = require('fs');

// Read env file
const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/POSTGRES_URL=["']?([^"'\n]+)["']?/);
const url = match ? match[1].trim() : null;

if (!url) {
  console.error('No POSTGRES_URL found');
  process.exit(1);
}

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders'`)
  .then(r => {
    console.log('Orders table columns:');
    console.log(JSON.stringify(r.rows, null, 2));
  })
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());
