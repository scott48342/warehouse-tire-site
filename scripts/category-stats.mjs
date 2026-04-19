import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const result = await pool.query(`
  SELECT category, 
         COUNT(*)::int as total,
         SUM(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END)::int as with_images
  FROM accessories 
  GROUP BY category 
  ORDER BY total DESC
`);

console.log('\nCategory Breakdown (with images / total):');
console.log('==========================================');
for (const row of result.rows) {
  const pct = row.total > 0 ? Math.round(row.with_images / row.total * 100) : 0;
  console.log(`${row.category.padEnd(30)} ${String(row.with_images).padStart(5)} / ${String(row.total).padStart(5)}  (${pct}%)`);
}

await pool.end();
