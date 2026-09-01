const { Client } = require("pg");
const fs = require("fs");
const env = fs.readFileSync("C:/Users/Scott-Pc/backup clawd/warehouse-tire-site/.env.local", "utf8");
const url = env.match(/POSTGRES_URL="?([^\r\n"]+)/)[1];
const c = new Client({ connectionString: url });
c.connect().then(async () => {
  const r = await c.query(
    "SELECT year, model, display_trim, bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes FROM vehicle_fitments WHERE make ILIKE 'dodge' AND model ILIKE '%intrepid%' ORDER BY year"
  );
  console.log("INTREPID rows:", r.rowCount);
  r.rows.forEach((x) => console.log(JSON.stringify(x)));
  const m = await c.query("SELECT DISTINCT model FROM vehicle_fitments WHERE make ILIKE 'dodge' ORDER BY model");
  console.log("DODGE MODELS:", m.rows.map((x) => x.model).join(", "));
  // Also check a sibling LH car for schema/format reference
  const s = await c.query(
    "SELECT * FROM vehicle_fitments WHERE make ILIKE 'chrysler' AND model ILIKE '%concorde%' ORDER BY year LIMIT 3"
  );
  console.log("CONCORDE sample rows:", s.rowCount);
  s.rows.forEach((x) => console.log(JSON.stringify(x)));
  await c.end();
}).catch((e) => { console.error("ERR:", e.message); process.exit(1); });
