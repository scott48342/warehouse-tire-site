import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Proper wheel specifications for the vehicles with corrupted/missing data
const fixes = [
  // 2013 Dodge Avenger - FWD sedan
  {
    year: 2013, make: 'dodge', model: 'avenger',
    wheels: [
      { width: 7, diameter: 17 },
      { width: 7.5, diameter: 18 }
    ]
  },
  // 1999 Nissan Maxima
  {
    year: 1999, make: 'nissan', model: 'maxima',
    wheels: [
      { width: 6.5, diameter: 15 },
      { width: 7, diameter: 16 }
    ]
  },
  // 2026 Rivian R1S - EV SUV
  {
    year: 2026, make: 'rivian', model: 'r1s',
    wheels: [
      { width: 9, diameter: 20 },
      { width: 9.5, diameter: 21 },
      { width: 10, diameter: 22 }
    ]
  },
  // 2024 Chevy Silverado 3500 HD - Heavy duty truck
  {
    year: 2024, make: 'chevrolet', model: 'silverado-3500-hd',
    wheels: [
      { width: 8, diameter: 18 },
      { width: 8.5, diameter: 20 }
    ]
  }
];

async function fixWheels() {
  for (const fix of fixes) {
    const result = await pool.query(
      `UPDATE vehicle_fitments 
       SET oem_wheel_sizes = $1, updated_at = NOW()
       WHERE year = $2 AND make = $3 AND model = $4`,
      [JSON.stringify(fix.wheels), fix.year, fix.make, fix.model]
    );
    console.log(`Fixed ${fix.year} ${fix.make} ${fix.model}: ${result.rowCount} rows updated`);
  }
  await pool.end();
}

fixWheels();
