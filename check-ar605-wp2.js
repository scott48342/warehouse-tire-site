const postgres = require("postgres");

async function main() {
  const client = postgres("postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require");
  
  const result = await client`
    SELECT sku, qoh 
    FROM wp_inventory 
    WHERE sku LIKE 'AR605%'
    ORDER BY sku
  `;
  
  console.log("AR605 in WP inventory:", result.length);
  result.forEach(r => console.log(r.sku + ": qoh=" + r.qoh));
  
  await client.end();
}

main().catch(console.error);