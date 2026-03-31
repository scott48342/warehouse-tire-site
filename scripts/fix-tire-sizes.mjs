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
    year: 2005,
    make: 'chrysler',
    model: '300c',
    oem_tire_sizes: JSON.stringify(['225/60R18', '245/45R20', '255/45R20'])
  },
  {
    year: 2010,
    make: 'ford',
    model: 'mustang',
    oem_tire_sizes: JSON.stringify(['215/60R17', '235/50R18', '245/45R19', '255/45R18', '285/40R18', '255/40R19', '285/35R19'])
  },
  {
    year: 2021,
    make: 'ford',
    model: 'mustang',
    oem_tire_sizes: JSON.stringify(['235/55R17', '255/40R19', '265/40R19', '305/30R20', '315/30R20'])
  },
  {
    year: 2022,
    make: 'toyota',
    model: 'sienna',
    oem_tire_sizes: JSON.stringify(['235/65R17', '235/60R18', '235/50R20'])
  }
];

try {
  for (const u of updates) {
    const result = await pool.query(
      `UPDATE vehicle_fitments 
       SET oem_tire_sizes = $1 
       WHERE year = $2 AND make = $3 AND model = $4
       RETURNING year, make, model`,
      [u.oem_tire_sizes, u.year, u.make, u.model]
    );
    
    if (result.rowCount > 0) {
      console.log(`✅ Updated ${u.year} ${u.make} ${u.model}: ${u.oem_tire_sizes}`);
    } else {
      console.log(`❌ Not found: ${u.year} ${u.make} ${u.model}`);
    }
  }
} finally {
  await pool.end();
}
