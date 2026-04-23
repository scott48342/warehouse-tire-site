import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const adx = await client.query("SELECT * FROM vehicle_fitments WHERE LOWER(model) LIKE '%adx%'");
console.log("Full ADX records:");
adx.rows.forEach(r => {
  console.log("\n" + r.year + " " + r.make + " " + r.model);
  console.log("  Trim:", r.display_trim);
  console.log("  Bolt pattern:", r.bolt_pattern);
  console.log("  Hub bore:", r.center_bore_mm);
  console.log("  OEM wheels:", r.oem_wheel_sizes);
  console.log("  OEM tires:", r.oem_tire_sizes);
  console.log("  Source:", r.source);
  console.log("  Created:", r.created_at);
});

await client.end();
