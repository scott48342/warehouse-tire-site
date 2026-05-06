import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicle_fitments' ORDER BY ordinal_position`);
console.log('vehicle_fitments columns:');
r.rows.forEach(row => console.log('  ' + row.column_name + ' (' + row.data_type + ')'));

// Also check a sample row
const sample = await pool.query(`SELECT * FROM vehicle_fitments WHERE make = 'Chevrolet' AND model = 'Camaro' LIMIT 1`);
if (sample.rows.length > 0) {
  console.log('\nSample Camaro row:');
  console.log(JSON.stringify(sample.rows[0], null, 2));
}

await pool.end();
