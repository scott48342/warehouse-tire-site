import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// SKUs from DealerLine for 2020 Silverado 2500 HD
const dealerLineSkus = [
  '42-30660', '88-33200', '26-3204', '26-3205', '66-3112', '66-3122',
  '66-7822B', '67-3413', '69-30320', '44-30620', '44-30820', '66-3020',
  '66-30200', '67-12238', '26-30100', '42-30640', 'PCSGMLLR223-2',
  '69-30300', '67-30320', 'PCSGMLL231', '44-30621', '44-30821'
];

console.log('Checking which DealerLine 2500 HD SKUs exist in our DB:\n');

for (const sku of dealerLineSkus) {
  const r = await pool.query(`
    SELECT sku, product_desc, make, model, year_start, year_end 
    FROM suspension_fitments 
    WHERE sku = $1
  `, [sku]);
  
  if (r.rows.length > 0) {
    console.log(`✅ ${sku}: ${r.rows[0].product_desc} → ${r.rows[0].make} ${r.rows[0].model}`);
  } else {
    console.log(`❌ ${sku}: NOT IN DB`);
  }
}

await pool.end();
