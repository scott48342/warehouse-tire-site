/**
 * Migration: Add trim_fitments table
 * Run this before importing tire validation results
 */
import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

console.log('Running migration: add trim_fitments table...\n');

const sql = fs.readFileSync('scripts/tire-validation/add-trim-table.sql', 'utf-8');

try {
  await client.query(sql);
  console.log('✅ trim_fitments table created successfully');
  
  // Verify
  const { rows } = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'trim_fitments'
    ORDER BY ordinal_position
  `);
  
  console.log('\nTable structure:');
  console.table(rows);
  
} catch (err) {
  if (err.code === '42P07') {
    console.log('ℹ️  Table already exists');
  } else {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

await client.end();
console.log('\nMigration complete!');
