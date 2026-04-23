import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();

// Get column info
const cols = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns 
  WHERE table_name = 'vehicle_fitments'
  ORDER BY ordinal_position
`);

console.log('=== vehicle_fitments columns ===');
cols.rows.forEach(c => {
  const nullable = c.is_nullable === 'YES' ? '' : ' NOT NULL';
  const def = c.column_default ? ` DEFAULT ${c.column_default.slice(0, 30)}` : '';
  console.log(`${c.column_name.padEnd(25)} ${c.data_type.padEnd(15)}${nullable}${def}`);
});

// Get a sample row
const sample = await client.query(`
  SELECT * FROM vehicle_fitments 
  WHERE year = 1980 AND LOWER(model) = 'suburban' 
  LIMIT 1
`);
console.log('\n=== Sample row ===');
console.log(sample.rows[0]);

client.release();
await pool.end();
