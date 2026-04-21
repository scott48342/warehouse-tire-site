import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Top makes
const makes = await pool.query(`
  SELECT make, COUNT(*) as count, SUM(occurrence_count) as searches
  FROM unresolved_fitment_searches
  GROUP BY make
  ORDER BY searches DESC
  LIMIT 20
`);

console.log('Top makes with remaining gaps:');
makes.rows.forEach(row => console.log(`  ${row.make}: ${row.count} vehicles, ${row.searches} searches`));

// Sample of high-search vehicles
console.log('\nTop individual vehicles:');
const top = await pool.query(`
  SELECT year, make, model, occurrence_count, search_type
  FROM unresolved_fitment_searches
  ORDER BY occurrence_count DESC
  LIMIT 20
`);

top.rows.forEach(row => console.log(`  ${row.year} ${row.make} ${row.model}: ${row.occurrence_count} (${row.search_type})`));

await pool.end();
