import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const a26 = await client.query("SELECT model, display_trim, oem_tire_sizes FROM vehicle_fitments WHERE year = 2026 AND LOWER(make) = 'acura'");
console.log("2026 Acura in DB:");
a26.rows.forEach(r => console.log("  " + r.model + " (" + r.display_trim + "): " + r.oem_tire_sizes));

// Also check what the site API returns
console.log("\n--- Checking for ADX specifically ---");
const adx = await client.query("SELECT * FROM vehicle_fitments WHERE LOWER(model) LIKE '%adx%'");
console.log("Any ADX in entire DB:", adx.rows.length > 0 ? adx.rows.map(r => r.year + " " + r.make + " " + r.model).join(", ") : "none");

await client.end();
