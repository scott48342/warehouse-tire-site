const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const client = postgres(process.env.POSTGRES_URL);

// Petrol 5x115 18/19" SKUs from techfeed
const skus = [
  '1980P3C405115F76',
  '1880P3C405115B76',
  '1880P3C405115F76',
  '1980P3C405115B76',
  '1880P1C405115B76',
  '1880P5C405115G76',
  '1880P5C405115M76',
  'PE001BX18801540',
  'PE002BX18801540',
  'PE002SX18801540',
];

(async () => {
  console.log('Checking inventory for Petrol 5x115 18/19" wheels:\n');
  
  for (const sku of skus) {
    const inv = await client`SELECT * FROM wp_inventory WHERE sku = ${sku}`;
    if (inv.length > 0) {
      console.log(`${sku}: qoh=${inv[0].qoh}, run_date=${inv[0].run_date}`);
    } else {
      console.log(`${sku}: NOT IN INVENTORY TABLE`);
    }
  }
  
  // Also check what the inventory cache function would return
  console.log('\n--- Checking wp_inventory for ALL Petrol 5x115 ---');
  const allPetrol = await client`
    SELECT i.sku, i.qoh, i.run_date
    FROM wp_inventory i
    WHERE i.sku LIKE '%P_C405115%' OR i.sku LIKE 'PE00%1540'
    ORDER BY i.qoh DESC
    LIMIT 20
  `;
  allPetrol.forEach(r => console.log(`  ${r.sku}: qoh=${r.qoh}`));
  
  await client.end();
})();
