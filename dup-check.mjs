import pg from 'pg';
import 'dotenv/config';
const { Client } = pg;

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

// Total count
const totalRes = await client.query('SELECT COUNT(*) as total FROM vehicle_fitments');
console.log('Total records:', totalRes.rows[0].total);

// Find duplicates by year/make/model/trim/boltPattern
const dupRes = await client.query(`
  SELECT year, make, model, trim, "boltPattern", COUNT(*) as cnt
  FROM vehicle_fitments
  GROUP BY year, make, model, trim, "boltPattern"
  HAVING COUNT(*) > 1
  ORDER BY cnt DESC
  LIMIT 20
`);

console.log('\nDuplicate groups (same year/make/model/trim/bolt):', dupRes.rows.length, 'total');
if (dupRes.rows.length > 0) {
  console.log('\nTop 10 duplicates:');
  dupRes.rows.slice(0, 10).forEach(r => {
    console.log(`  ${r.year} ${r.make} ${r.model} [${r.trim}] ${r.boltPattern}: ${r.cnt} copies`);
  });
}

// Count total redundant records
const totalDupRes = await client.query(`
  SELECT SUM(cnt - 1) as redundant FROM (
    SELECT COUNT(*) as cnt
    FROM vehicle_fitments
    GROUP BY year, make, model, trim, "boltPattern"
    HAVING COUNT(*) > 1
  ) x
`);
console.log('\nTotal redundant records:', totalDupRes.rows[0].redundant || 0);

await client.end();
