import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const dbMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const vehicles = [
  { year: 2005, make: 'chrysler', model: '300c' },
  { year: 2010, make: 'ford', model: 'mustang' },
  { year: 2021, make: 'ford', model: 'mustang' },
  { year: 2022, make: 'toyota', model: 'sienna' }
];

try {
  for (const v of vehicles) {
    const r = await pool.query(
      'SELECT year, make, model, oem_tire_sizes FROM vehicle_fitments WHERE year = $1 AND make = $2 AND model = $3',
      [v.year, v.make, v.model]
    );
    if (r.rows.length > 0) {
      console.log(`${v.year} ${v.make} ${v.model}: ${JSON.stringify(r.rows[0].oem_tire_sizes)}`);
    } else {
      console.log(`${v.year} ${v.make} ${v.model}: NOT IN DB`);
    }
  }
} finally {
  await pool.end();
}
