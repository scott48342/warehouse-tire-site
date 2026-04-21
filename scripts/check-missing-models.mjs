import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Check what years exist for these models
const models = [
  ['dodge', 'journey'],
  ['mazda', 'mazda6'],
];

console.log('Existing years in database:\n');

for (const [make, model] of models) {
  const r = await pool.query(
    'SELECT DISTINCT year FROM vehicle_fitments WHERE LOWER(make) = $1 AND LOWER(model) = $2 ORDER BY year',
    [make, model]
  );
  console.log(`${make} ${model}: ${r.rows.length > 0 ? r.rows.map(x => x.year).join(', ') : 'NONE'}`);
}

pool.end();
