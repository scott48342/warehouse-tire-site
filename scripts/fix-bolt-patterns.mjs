import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Bolt pattern data for failing vehicles
const fixes = [
  { 
    year: 2005, make: 'Chrysler', model: '300C',
    boltPattern: '5x115', centerBoreMm: 71.5, threadSize: 'M14x1.5'
  },
  { 
    year: 2010, make: 'Ford', model: 'Mustang',
    boltPattern: '5x114.3', centerBoreMm: 70.6, threadSize: 'M14x1.5'
  },
  { 
    year: 2021, make: 'Ford', model: 'Mustang',
    boltPattern: '5x114.3', centerBoreMm: 70.6, threadSize: 'M14x1.5'
  },
  { 
    year: 2022, make: 'Toyota', model: 'Sienna',
    boltPattern: '5x114.3', centerBoreMm: 60.1, threadSize: 'M12x1.5'
  },
];

try {
  console.log("Fixing bolt patterns for failing vehicles:\n");
  
  for (const fix of fixes) {
    const result = await pool.query(`
      UPDATE vehicle_fitments 
      SET 
        bolt_pattern = $4,
        center_bore_mm = $5,
        thread_size = $6,
        updated_at = NOW()
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
        AND (bolt_pattern IS NULL OR bolt_pattern = '')
      RETURNING id, display_trim
    `, [fix.year, fix.make, fix.model, fix.boltPattern, fix.centerBoreMm, fix.threadSize]);
    
    console.log(`${fix.year} ${fix.make} ${fix.model}: Updated ${result.rowCount} records`);
    console.log(`  → ${fix.boltPattern}, CB: ${fix.centerBoreMm}mm, Thread: ${fix.threadSize}`);
  }
  
  console.log("\n✅ Done!");
  
} finally {
  await pool.end();
}
