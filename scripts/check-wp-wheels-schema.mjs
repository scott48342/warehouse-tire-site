import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: true,
});

const result = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'wp_wheels'
  ORDER BY ordinal_position
`);

console.log('wp_wheels columns:');
for (const row of result.rows) {
  console.log(`  ${row.column_name}: ${row.data_type}`);
}

// Sample data
const sample = await pool.query(`
  SELECT * FROM wp_wheels LIMIT 3
`);
console.log('\nSample rows:');
console.log(JSON.stringify(sample.rows, null, 2));

// Count
const count = await pool.query(`SELECT COUNT(*) FROM wp_wheels`);
console.log(`\nTotal rows: ${count.rows[0].count}`);

// Bolt pattern samples
const bpSample = await pool.query(`
  SELECT DISTINCT bolt_pattern_1, bolt_pattern_2 
  FROM wp_wheels 
  WHERE bolt_pattern_1 IS NOT NULL 
  LIMIT 10
`);
console.log('\nBolt pattern samples:');
for (const row of bpSample.rows) {
  console.log(`  ${row.bolt_pattern_1} / ${row.bolt_pattern_2 || '-'}`);
}

await pool.end();
