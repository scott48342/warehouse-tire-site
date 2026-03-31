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

const updates = [
  {
    year: 2021,
    make: 'ford',
    model: 'mustang',
    oem_tire_sizes: ['235/55R17', '235/50R18', '255/40R19', '265/40R19', '265/35R20', '275/40R19', '305/30R20', '315/30R20']
  }
];

try {
  for (const u of updates) {
    const result = await pool.query(
      `UPDATE vehicle_fitments 
       SET oem_tire_sizes = $1 
       WHERE year = $2 AND make = $3 AND model = $4
       RETURNING year, make, model`,
      [JSON.stringify(u.oem_tire_sizes), u.year, u.make, u.model]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ Updated ${u.year} ${u.make} ${u.model}: ${u.oem_tire_sizes.join(', ')}`);
    } else {
      console.log(`❌ Not found: ${u.year} ${u.make} ${u.model}`);
    }
  }
} finally {
  await pool.end();
}
