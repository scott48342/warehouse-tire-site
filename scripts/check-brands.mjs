import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const tires = await pool.query(`SELECT DISTINCT brand, source FROM tires WHERE brand IS NOT NULL ORDER BY brand`);
console.log(`=== TIRE BRANDS IN DB (${tires.rows.length}) ===`);

const bySource = {};
tires.rows.forEach(r => {
  if (!bySource[r.source]) bySource[r.source] = [];
  bySource[r.source].push(r.brand);
});
Object.keys(bySource).sort().forEach(src => {
  console.log(`\n${src}:`, bySource[src].join(', '));
});

// Check specifically for these brands
const search = await pool.query(`
  SELECT DISTINCT brand, source FROM tires 
  WHERE LOWER(brand) LIKE '%ironman%' 
     OR LOWER(brand) LIKE '%argus%' 
     OR LOWER(brand) LIKE '%rbp%'
`);
console.log('\n=== FOUND IRONMAN/ARGUS/RBP ===');
console.log(search.rows.length ? search.rows : 'NONE FOUND');

await pool.end();
