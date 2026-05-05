/**
 * Approve the pilot OEM package choices for 2024 RAM 1500 Big Horn
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log("Approving 2024 RAM 1500 Big Horn package choices...\n");

const result = await pool.query(`
  UPDATE oem_package_choices
  SET status = 'approved',
      reviewed_at = NOW(),
      reviewed_by = 'clawd-verification'
  WHERE year = 2024 
    AND make = 'Ram' 
    AND model = '1500'
    AND trim = 'Big Horn'
    AND status = 'pending'
  RETURNING package_label, wheel_diameter, tire_size, status
`);

console.log(`✅ Approved ${result.rowCount} package choice(s):\n`);
result.rows.forEach(r => {
  console.log(`  ${r.package_label} (${r.wheel_diameter}") - ${r.tire_size} [${r.status}]`);
});

// Verify
const verify = await pool.query(`
  SELECT package_label, wheel_diameter, tire_size, status
  FROM oem_package_choices
  WHERE year = 2024 AND make = 'Ram' AND model = '1500'
  ORDER BY display_order
`);

console.log("\nCurrent package choices for 2024 RAM 1500:");
verify.rows.forEach(r => {
  console.log(`  ${r.package_label}: ${r.tire_size} [${r.status}]`);
});

await pool.end();
