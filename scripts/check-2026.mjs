import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const makes = await client.query("SELECT make, COUNT(*) as count FROM vehicle_fitments WHERE year = 2026 GROUP BY make ORDER BY count DESC");
console.log("2026 vehicles by make:");
makes.rows.forEach(r => console.log("  " + r.make + ": " + r.count));
console.log("\nTotal 2026 records:", makes.rows.reduce((a, r) => a + parseInt(r.count), 0));

// Check specifically for new 2025-2026 models
const recent = await client.query("SELECT DISTINCT make, model FROM vehicle_fitments WHERE year >= 2025 AND make = 'Acura' ORDER BY make, model");
console.log("\nAcura 2025-2026 models:");
recent.rows.forEach(r => console.log("  " + r.make + " " + r.model));

await client.end();
