const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const client = postgres(process.env.POSTGRES_URL);

(async () => {
  // Check Petrol SKUs with good inventory
  const petrolInStock = await client`
    SELECT w.sku, w.style, w.diameter_in, w.msrp_usd, w.bolt_pattern_metric, i.qoh, i.run_date
    FROM wp_wheels w
    INNER JOIN wp_inventory i ON w.sku = i.sku
    WHERE w.brand_code_3 = 'PET' 
    AND w.bolt_pattern_metric = '5X115'
    AND i.qoh >= 4
    ORDER BY w.msrp_usd ASC
    LIMIT 20
  `;
  console.log('Petrol 5x115 with qoh >= 4:', petrolInStock.length);
  petrolInStock.forEach(w => 
    console.log(`  ${w.sku}: ${w.style} ${w.diameter_in}" ${w.bolt_pattern_metric} - $${w.msrp_usd} (qty: ${w.qoh}, updated: ${w.run_date})`)
  );
  
  // Check if these SKUs are in WheelPros techfeed (fitments)
  console.log('\n--- Checking fitment data ---');
  const skus = petrolInStock.map(w => w.sku);
  
  // Check if there's a fitment table
  const tables = await client`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%fit%'
  `;
  console.log('Fitment tables:', tables.map(t => t.table_name).join(', '));
  
  // Check what tables have these SKUs
  const wpWheels = await client`SELECT COUNT(*) as cnt FROM wp_wheels WHERE sku = ANY(${skus})`;
  console.log(`wp_wheels has ${wpWheels[0].cnt} of these SKUs`);
  
  const wpInventory = await client`SELECT COUNT(*) as cnt FROM wp_inventory WHERE sku = ANY(${skus})`;
  console.log(`wp_inventory has ${wpInventory[0].cnt} of these SKUs`);
  
  await client.end();
})();
