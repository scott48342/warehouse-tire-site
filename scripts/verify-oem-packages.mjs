/**
 * Verify OEM Package Choices feature is set up correctly
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log("=".repeat(70));
console.log("OEM PACKAGE CHOICES - FEATURE VERIFICATION");
console.log("=".repeat(70));

// 1. Verify table exists
const tableCheck = await pool.query(`
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'oem_package_choices'
  ) as exists
`);
console.log(`\n1. Table exists: ${tableCheck.rows[0].exists ? '✅' : '❌'}`);

// 2. Verify columns
const columns = await pool.query(`
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'oem_package_choices'
  ORDER BY ordinal_position
`);
console.log(`\n2. Columns (${columns.rows.length}):`);
columns.rows.forEach(r => console.log(`   - ${r.column_name}`));

// 3. Verify seed data
const seedData = await pool.query(`
  SELECT year, make, model, trim, package_label, wheel_diameter, tire_size, status
  FROM oem_package_choices
  ORDER BY year, make, model, trim, display_order
`);
console.log(`\n3. Package choices (${seedData.rows.length} total):`);

const byVehicle = {};
seedData.rows.forEach(r => {
  const key = `${r.year} ${r.make} ${r.model} ${r.trim}`;
  if (!byVehicle[key]) byVehicle[key] = [];
  byVehicle[key].push(r);
});

for (const [vehicle, choices] of Object.entries(byVehicle)) {
  console.log(`\n   ${vehicle}:`);
  choices.forEach(c => {
    const statusIcon = c.status === 'approved' ? '✅' : c.status === 'pending' ? '⏳' : '❌';
    console.log(`     ${statusIcon} ${c.package_label} (${c.wheel_diameter}") - ${c.tire_size}`);
  });
}

// 4. Summary
const summary = await pool.query(`
  SELECT status, COUNT(*) as count FROM oem_package_choices GROUP BY status
`);
console.log("\n4. Status summary:");
summary.rows.forEach(r => console.log(`   ${r.status}: ${r.count}`));

// 5. Test query for 2024 Ram 1500 Big Horn
console.log("\n5. Test query for 2024 Ram 1500 Big Horn:");
const testQuery = await pool.query(`
  SELECT package_label, wheel_diameter, tire_size, tire_size_rear, status
  FROM oem_package_choices
  WHERE year = 2024 
    AND LOWER(make) = 'ram' 
    AND LOWER(model) = '1500'
    AND LOWER(trim) = 'big horn'
    AND status = 'approved'
  ORDER BY display_order
`);
if (testQuery.rows.length > 0) {
  console.log("   ✅ Found approved package choices:");
  testQuery.rows.forEach(r => {
    console.log(`      - ${r.package_label}: ${r.tire_size}`);
  });
} else {
  console.log("   ❌ No approved package choices found");
}

console.log("\n" + "=".repeat(70));
console.log("VERIFICATION COMPLETE");
console.log("=".repeat(70));

await pool.end();
