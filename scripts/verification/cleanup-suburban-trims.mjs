import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();

// Clean up the ugly combined trim names for modern Suburban
const result = await client.query(`
  UPDATE vehicle_fitments 
  SET display_trim = 'LS'
  WHERE LOWER(make) = 'chevrolet' 
  AND LOWER(model) = 'suburban' 
  AND display_trim LIKE '%Premier%'
  AND year >= 2000
`);
console.log('Cleaned up', result.rowCount, 'Suburban trim names (2000+)');

// Show final state
const final = await client.query(`
  SELECT display_trim, COUNT(*)::int as count 
  FROM vehicle_fitments 
  WHERE LOWER(make) = 'chevrolet' AND LOWER(model) = 'suburban'
  GROUP BY display_trim
  ORDER BY count DESC
`);
console.log('\n=== Final Suburban trims ===');
console.table(final.rows);

client.release();
await pool.end();
