import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({connectionString: dbUrl, ssl: {rejectUnauthorized: false}});

// Check if Honda Accord 2024 has tire sizes
const result = await pool.query(`
  SELECT year, make, model, oem_tire_sizes::text 
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'honda' AND LOWER(model) = 'accord' AND year = 2024
`);
console.log('Honda Accord 2024 in DB:');
console.log(JSON.stringify(result.rows, null, 2));

// Check Crossfire
const crossfire = await pool.query(`
  SELECT year, make, model, oem_tire_sizes::text 
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'chrysler' AND LOWER(model) = 'crossfire'
`);
console.log('\nChrysler Crossfire in DB:');
console.log(JSON.stringify(crossfire.rows, null, 2));

await pool.end();
