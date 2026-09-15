import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const r = (await p.query(`select year, make, display_trim, bolt_pattern, quarantined_at is not null quar, last_modified_reason, updated_at
  from vehicle_fitments where (make='chevrolet' and model='astro') or (make='gmc' and model='safari') order by make, year, display_trim`)).rows;
for (const x of r) console.log(`${x.year} ${x.make} ${x.display_trim} ${x.bolt_pattern}${x.quar ? ' QUAR' : ''} | ${(x.last_modified_reason || '').slice(0, 90)} | ${x.updated_at.toISOString().slice(11, 16)}`);
await p.end();
