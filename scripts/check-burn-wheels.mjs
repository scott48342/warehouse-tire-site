import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

// Check if BURN wheels exist in wp_wheels
const result = await pool.query(`
  SELECT sku, style_desc, brand_desc, bolt_pattern_metric, wheel_diameter, width, "offset", centerbore
  FROM wp_wheels
  WHERE LOWER(style_desc) LIKE '%burn%'
  LIMIT 20
`);

console.log("BURN wheels in wp_wheels:", result.rows.length);
if (result.rows.length > 0) {
  console.log("\nSample:");
  result.rows.slice(0, 5).forEach(w => {
    console.log(`  ${w.sku}: ${w.style_desc} | ${w.bolt_pattern_metric} | ${w.wheel_diameter}x${w.width} | offset ${w.offset} | bore ${w.centerbore}`);
  });
}

// Check if they're in inventory
const invResult = await pool.query(`
  SELECT w.sku, w.style_desc, i.qty_local, i.qty_all
  FROM wp_wheels w
  LEFT JOIN wheel_inventory i ON w.sku = i.sku
  WHERE LOWER(w.style_desc) LIKE '%burn%'
  LIMIT 10
`);

console.log("\n\nBURN wheels with inventory:");
invResult.rows.forEach(w => {
  console.log(`  ${w.sku}: ${w.style_desc} | local: ${w.qty_local ?? 'N/A'}, all: ${w.qty_all ?? 'N/A'}`);
});

await pool.end();
