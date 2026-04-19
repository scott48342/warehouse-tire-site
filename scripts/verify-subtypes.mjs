import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

// Check for any remaining "light bar" with space
const spaceVersion = await pool.query(`
  SELECT COUNT(*) as count FROM accessories WHERE sub_type = 'light bar'
`);
console.log('Products with sub_type = "light bar" (space):', spaceVersion.rows[0].count);

const underscoreVersion = await pool.query(`
  SELECT COUNT(*) as count FROM accessories WHERE sub_type = 'light_bar'
`);
console.log('Products with sub_type = "light_bar" (underscore):', underscoreVersion.rows[0].count);

// Show all sub_types in lighting category
const allTypes = await pool.query(`
  SELECT sub_type, COUNT(*) as count 
  FROM accessories 
  WHERE category = 'lighting'
  GROUP BY sub_type
  ORDER BY count DESC
`);
console.log('\nAll sub_types in lighting category:');
console.table(allTypes.rows);

await pool.end();
