#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  const res = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments' 
    ORDER BY ordinal_position
  `);
  console.log('vehicle_fitments columns:');
  console.log(res.rows.map(r => r.column_name).join(', '));
  
  const res2 = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitment_configurations' 
    ORDER BY ordinal_position
  `);
  console.log('\nvehicle_fitment_configurations columns:');
  console.log(res2.rows.map(r => r.column_name).join(', '));
  
  await pool.end();
}

main();
