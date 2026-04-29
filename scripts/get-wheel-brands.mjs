import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ 
  connectionString: 'postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function getBrands() {
  const res = await pool.query(`
    SELECT DISTINCT brand_desc as brand, COUNT(*) as count
    FROM wp_wheels
    WHERE brand_desc IS NOT NULL AND brand_desc != ''
    GROUP BY brand_desc
    ORDER BY brand_desc
  `);
  console.log('Wheel brands:', res.rows.length);
  console.log(JSON.stringify(res.rows, null, 2));
  
  await pool.end();
}

getBrands().catch(console.error);
