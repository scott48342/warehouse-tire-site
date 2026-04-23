import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Correct ADX specs from Acura dealer site
const correctTires = ['225/55R18', '235/45R19'];
const correctWheels = [
  { width: 7.5, offset: 45, diameter: 18, position: 'both' },
  { width: 8.5, offset: 35, diameter: 19, position: 'both' }
];

const result = await client.query(`
  UPDATE vehicle_fitments 
  SET oem_tire_sizes = $1, 
      oem_wheel_sizes = $2,
      source = 'manual-fix [dealer-verified]',
      updated_at = NOW()
  WHERE LOWER(model) = 'adx' AND LOWER(make) = 'acura'
  RETURNING year, make, model
`, [JSON.stringify(correctTires), JSON.stringify(correctWheels)]);

console.log("Fixed", result.rowCount, "ADX records:");
result.rows.forEach(r => console.log("  " + r.year + " " + r.make + " " + r.model));

// Verify
const verify = await client.query("SELECT year, oem_tire_sizes, oem_wheel_sizes FROM vehicle_fitments WHERE LOWER(model) = 'adx'");
console.log("\nVerified:");
verify.rows.forEach(r => {
  console.log("  " + r.year + ": tires=" + JSON.stringify(r.oem_tire_sizes) + ", wheels=" + JSON.stringify(r.oem_wheel_sizes));
});

await client.end();
