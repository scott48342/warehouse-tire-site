import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function validate() {
  // Check for Trail Boss / AT4 specific kits
  console.log('=== TRAIL BOSS / AT4 KITS ===');
  const tb = await pool.query(`
    SELECT sku, product_desc, make, model 
    FROM suspension_fitments 
    WHERE product_desc ILIKE '%TRAIL BOSS%' OR product_desc ILIKE '%AT4%' 
    LIMIT 10
  `);
  tb.rows.forEach(r => console.log(`${r.sku}: ${r.product_desc.slice(0,60)}`));
  
  // Check for 2WD/4WD distinctions
  console.log('\n=== 2WD/4WD KITS ===');
  const wd = await pool.query(`
    SELECT sku, product_desc 
    FROM suspension_fitments 
    WHERE product_desc ILIKE '%2WD%' OR product_desc ILIKE '%4WD%' 
       OR product_desc ILIKE '%4X4%' OR product_desc ILIKE '%4X2%' 
    LIMIT 10
  `);
  wd.rows.forEach(r => console.log(`${r.sku}: ${r.product_desc.slice(0,60)}`));
  
  // Check lift height distribution
  console.log('\n=== LIFT HEIGHT DISTRIBUTION ===');
  const lh = await pool.query(`
    SELECT lift_height, COUNT(*) as cnt 
    FROM suspension_fitments 
    WHERE lift_height IS NOT NULL 
    GROUP BY lift_height 
    ORDER BY lift_height
  `);
  lh.rows.forEach(r => console.log(`${r.lift_height}": ${r.cnt} kits`));
  
  // Check records without lift height
  const noLift = await pool.query(`SELECT COUNT(*) as cnt FROM suspension_fitments WHERE lift_height IS NULL`);
  console.log(`No lift height: ${noLift.rows[0].cnt} records`);
  
  // Check vehicle coverage
  console.log('\n=== TOP VEHICLES ===');
  const veh = await pool.query(`
    SELECT make, model, COUNT(*) as cnt 
    FROM suspension_fitments 
    GROUP BY make, model 
    ORDER BY cnt DESC 
    LIMIT 15
  `);
  veh.rows.forEach(r => console.log(`${r.make} ${r.model}: ${r.cnt}`));
  
  // Check year coverage for popular trucks
  console.log('\n=== SILVERADO 1500 YEAR COVERAGE ===');
  const yrs = await pool.query(`
    SELECT DISTINCT year_start, year_end 
    FROM suspension_fitments 
    WHERE make = 'Chevrolet' AND model = 'Silverado 1500' 
    ORDER BY year_start
  `);
  yrs.rows.forEach(r => console.log(`${r.year_start}-${r.year_end}`));
  
  // Check lift kit types
  console.log('\n=== PRODUCT TYPES ===');
  const types = await pool.query(`
    SELECT product_type, COUNT(*) as cnt 
    FROM suspension_fitments 
    GROUP BY product_type 
    ORDER BY cnt DESC
  `);
  types.rows.forEach(r => console.log(`${r.product_type}: ${r.cnt}`));
  
  // Check brands
  console.log('\n=== BRANDS ===');
  const brands = await pool.query(`
    SELECT brand, COUNT(*) as cnt 
    FROM suspension_fitments 
    GROUP BY brand 
    ORDER BY cnt DESC
  `);
  brands.rows.forEach(r => console.log(`${r.brand}: ${r.cnt}`));
  
  await pool.end();
}

validate().catch(console.error);
