import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check what model formats exist
const result = await pool.query(`
  SELECT DISTINCT model 
  FROM vehicle_fitments 
  WHERE make ILIKE '%Chevrolet%' 
  AND (model ILIKE '%silverado%' AND model ILIKE '%2500%')
  LIMIT 10
`);
console.log("DB models containing 'silverado' and '2500':");
console.log(result.rows.map(r => r.model));

// Test exact ILIKE match
const test1 = await pool.query(`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE model ILIKE 'silverado-2500hd'
`);
console.log("\nCount for ILIKE 'silverado-2500hd':", test1.rows[0].cnt);

const test2 = await pool.query(`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE model ILIKE 'Silverado 2500HD'
`);
console.log("Count for ILIKE 'Silverado 2500HD':", test2.rows[0].cnt);

const test3 = await pool.query(`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE model ILIKE '%2500HD%'
`);
console.log("Count for ILIKE '%2500HD%':", test3.rows[0].cnt);

await pool.end();
