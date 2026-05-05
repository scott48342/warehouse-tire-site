import pg from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = readFileSync('./src/lib/db/migrations/0024_oem_package_choices.sql', 'utf8');

console.log('Running migration 0024_oem_package_choices...');

try {
  await pool.query(sql);
  console.log('✅ Migration complete!');
  
  // Verify seed data
  const result = await pool.query(`
    SELECT year, make, model, trim, package_label, wheel_diameter, tire_size, status
    FROM oem_package_choices
    ORDER BY display_order
  `);
  
  console.log('\nSeeded package choices:');
  result.rows.forEach(r => {
    console.log(`  ${r.year} ${r.make} ${r.model} ${r.trim}`);
    console.log(`    ${r.package_label} (${r.wheel_diameter}") - ${r.tire_size} [${r.status}]`);
  });
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

await pool.end();
