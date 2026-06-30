"use strict";
const pg = require("pg");
const fs = require("fs");

const env = fs.readFileSync(".env.local","utf8");
let url = "";
for (const l of env.split("\n")) { const m = l.match(/^POSTGRES_URL="([^"]+)"/); if(m){url=m[1];break;} }

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
c.connect().then(async () => {
  // Get wp_wheels columns
  const r1 = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='wp_wheels' ORDER BY ordinal_position LIMIT 30`);
  console.log("wp_wheels columns:");
  r1.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // Get wheel1_products columns
  const r2 = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='wheel1_products' ORDER BY ordinal_position LIMIT 30`);
  console.log("\nwheel1_products columns:");
  r2.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // Quick count
  const r3 = await c.query("SELECT COUNT(*) FROM wp_wheels WHERE is_active=TRUE AND bolt_pattern_metric='6x135'");
  console.log(`\nwp_wheels 6x135 active count: ${r3.rows[0].count}`);

  await c.end();
}).catch(e => console.error(e.message));
