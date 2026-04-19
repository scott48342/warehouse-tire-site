import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const statsQ = await pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE material IS NOT NULL) as has_material,
    COUNT(*) FILTER (WHERE style IS NOT NULL) as has_style,
    COUNT(*) FILTER (WHERE thread_size IS NOT NULL) as has_thread_size,
    COUNT(*) FILTER (WHERE hex_size IS NOT NULL) as has_hex_size,
    COUNT(*) FILTER (WHERE closed_end IS NOT NULL) as has_closed_end,
    COUNT(*) FILTER (WHERE package_type IS NOT NULL) as has_package_type,
    COUNT(*) FILTER (WHERE piece_count IS NOT NULL) as has_piece_count
  FROM accessories
`);
console.log('Filter stats:', statsQ.rows[0]);

const matQ = await pool.query(`SELECT DISTINCT material, COUNT(*) as cnt FROM accessories WHERE material IS NOT NULL GROUP BY material ORDER BY cnt DESC`);
console.log('Materials:', matQ.rows);

const styleQ = await pool.query(`SELECT DISTINCT style, COUNT(*) as cnt FROM accessories WHERE style IS NOT NULL GROUP BY style ORDER BY cnt DESC`);
console.log('Styles:', styleQ.rows);

const threadQ = await pool.query(`SELECT DISTINCT thread_size, COUNT(*) as cnt FROM accessories WHERE thread_size IS NOT NULL GROUP BY thread_size ORDER BY cnt DESC LIMIT 10`);
console.log('Top Thread Sizes:', threadQ.rows);

await pool.end();
