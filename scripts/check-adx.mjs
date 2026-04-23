import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const r = await client.query("SELECT year, make, model, display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes, source FROM vehicle_fitments WHERE year = 2026 AND make = 'Acura' AND model ILIKE '%adx%'");

if (r.rows.length === 0) {
  console.log("No 2026 Acura ADX found in fitment DB");
  
  // Check what 2026 Acuras we do have
  const acuras = await client.query("SELECT DISTINCT model FROM vehicle_fitments WHERE year = 2026 AND make = 'Acura'");
  console.log("\n2026 Acura models in DB:", acuras.rows.map(r => r.model).join(', ') || 'none');
} else {
  console.log("2026 Acura ADX records:");
  r.rows.forEach(row => {
    console.log("\nTrim:", row.display_trim);
    console.log("  Bolt pattern:", row.bolt_pattern);
    console.log("  Hub bore:", row.center_bore_mm, "mm");
    console.log("  OEM wheels:", row.oem_wheel_sizes);
    console.log("  OEM tires:", row.oem_tire_sizes);
    console.log("  Source:", row.source);
  });
}

await client.end();
