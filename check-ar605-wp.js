const postgres = require("postgres");

async function main() {
  const client = postgres("postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require");
  
  // Check WheelPros inventory for AR605 wheels
  const result = await client`
    SELECT sku, qty_oh 
    FROM wp_inventory 
    WHERE sku LIKE 'AR605%'
    ORDER BY sku
  `;
  
  console.log("AR605 in WheelPros inventory:", result.length);
  result.forEach(r => console.log(r.sku + ": qty=" + r.qty_oh));
  
  await client.end();
}

main().catch(console.error);