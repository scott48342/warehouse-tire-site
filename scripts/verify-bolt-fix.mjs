import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const vehicles = [
  { year: 2021, make: 'Ford', model: 'Mustang' },
  { year: 2022, make: 'Toyota', model: 'Sienna' },
  { year: 2005, make: 'Chrysler', model: '300C' },
  { year: 2010, make: 'Ford', model: 'Mustang' },
];

try {
  console.log("Verifying bolt pattern fix:\n");
  
  for (const v of vehicles) {
    const { rows } = await pool.query(`
      SELECT bolt_pattern, display_trim, oem_tire_sizes
      FROM vehicle_fitments 
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
      LIMIT 2
    `, [v.year, v.make, v.model]);
    
    console.log(`${v.year} ${v.make} ${v.model}:`);
    for (const row of rows) {
      const bp = row.bolt_pattern || '(NULL)';
      const sizes = row.oem_tire_sizes ? row.oem_tire_sizes.length : 0;
      console.log(`  ${row.display_trim}: bolt=${bp}, sizes=${sizes}`);
    }
    console.log('');
  }
  
} finally {
  await pool.end();
}
