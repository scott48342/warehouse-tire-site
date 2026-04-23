import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

const c57 = await client.query("SELECT model FROM vehicle_fitments WHERE year = 1957 AND make = 'Chevrolet'");
console.log('1957 Chevy:', c57.rows.map(r => r.model).join(', '));

const f70 = await client.query("SELECT model FROM vehicle_fitments WHERE year = 1970 AND make = 'Ford'");
console.log('1970 Ford:', f70.rows.map(r => r.model).join(', '));

const tbird = await client.query("SELECT year FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Thunderbird' ORDER BY year");
console.log('Thunderbird years:', tbird.rows.map(r => r.year).join(', '));

const bronco = await client.query("SELECT year FROM vehicle_fitments WHERE make = 'Ford' AND model = 'Bronco' ORDER BY year");
console.log('Bronco years:', bronco.rows.map(r => r.year).join(', '));

const scout = await client.query("SELECT year FROM vehicle_fitments WHERE make = 'International' ORDER BY year");
console.log('International Scout years:', scout.rows.map(r => r.year).join(', '));

await client.end();
