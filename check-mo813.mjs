import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const countResult = await pool.query(`
    SELECT COUNT(*) as count 
    FROM wheels 
    WHERE LOWER(style) LIKE '%mo813%' OR LOWER(part_number) LIKE '%mo813%'
  `);
  console.log('Total SKUs matching MO813:', countResult.rows[0].count);
  
  const samples = await pool.query(`
    SELECT part_number, style, diameter, width, bolt_pattern, finish 
    FROM wheels 
    WHERE LOWER(style) LIKE '%mo813%' OR LOWER(part_number) LIKE '%mo813%'
    ORDER BY diameter, width
  `);
  console.log(`\nAll ${samples.rows.length} SKUs:`);
  samples.rows.forEach(s => console.log(`  ${s.part_number} - ${s.style} - ${s.diameter}x${s.width} - ${s.bolt_pattern} - ${s.finish}`));
  
  await pool.end();
}

main();
