import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Check what HD descriptions we have
const r = await pool.query(`
  SELECT sku, product_desc, make, model 
  FROM suspension_fitments 
  WHERE product_desc ILIKE '%2500%' 
     OR product_desc ILIKE '%3500%' 
     OR product_desc ILIKE '% HD%'
     OR product_desc ILIKE '%HD-%'
  LIMIT 30
`);

console.log('HD-related descriptions in DB:');
r.rows.forEach(row => {
  console.log(`${row.sku}: ${row.product_desc} → ${row.make} ${row.model}`);
});

console.log('\n\nCount by model:');
const counts = await pool.query(`
  SELECT make, model, COUNT(*) as count 
  FROM suspension_fitments 
  WHERE make IN ('Chevrolet', 'GMC')
  GROUP BY make, model 
  ORDER BY make, model
`);
console.table(counts.rows);

await pool.end();
