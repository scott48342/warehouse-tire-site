#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function main() {
  // Check exact model values for F-150 Lightning
  const lightning = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments WHERE model ILIKE '%lightning%'
  `);
  console.log('Models with "lightning":', lightning.rows.map(r => r.model));
  
  // Check if getModelVariants would find it
  // Slugify: F-150 Lightning -> f-150-lightning
  const slugified = 'f-150-lightning';
  
  // Query with slugified name
  const result = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments WHERE model ILIKE $1
  `, [slugified]);
  console.log('ILIKE with "f-150-lightning":', result.rows);
  
  // Query with wildcard
  const result2 = await pool.query(`
    SELECT DISTINCT model FROM vehicle_fitments WHERE model ILIKE $1
  `, ['%f-150%lightning%']);
  console.log('ILIKE with "%f-150%lightning%":', result2.rows);
  
  // Check exact models for our problem vehicles
  const vehicles = [
    '%F-150 Lightning%',
    '%Silverado 2500%',
    '%Tacoma%',
    '%Bronco%',
    '%Corvette%',
    '%M3%',
    '%3500%',
  ];
  
  for (const v of vehicles) {
    const r = await pool.query(`
      SELECT DISTINCT model FROM vehicle_fitments WHERE model ILIKE $1
    `, [v]);
    console.log(`Models matching ${v}:`, r.rows.map(r => r.model));
  }
  
  await pool.end();
}

main();
