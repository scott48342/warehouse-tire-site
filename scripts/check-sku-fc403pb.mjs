import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const sku = "FC403PB20906301";

// Check if in wp_wheels
const wheelResult = await pool.query(`
  SELECT sku, style_desc, brand_desc, bolt_pattern_metric, wheel_diameter, width, "offset", centerbore
  FROM wp_wheels
  WHERE sku = $1
`, [sku]);

console.log("In wp_wheels:", wheelResult.rows.length > 0);
if (wheelResult.rows[0]) {
  console.log("  Specs:", JSON.stringify(wheelResult.rows[0], null, 2));
}

// Check if in inventory
const invResult = await pool.query(`
  SELECT sku, qty_local, qty_all, inv_type
  FROM wheel_inventory
  WHERE sku = $1
`, [sku]);

console.log("\nIn wheel_inventory:", invResult.rows.length > 0);
if (invResult.rows[0]) {
  console.log("  Inventory:", JSON.stringify(invResult.rows[0], null, 2));
}

// Check other PB finishes
const pbResult = await pool.query(`
  SELECT sku, style_desc
  FROM wp_wheels
  WHERE sku LIKE 'FC403PB%'
  LIMIT 10
`);

console.log("\nAll FC403PB SKUs in wp_wheels:", pbResult.rows.length);
pbResult.rows.forEach(r => console.log("  -", r.sku, r.style_desc));

await pool.end();
