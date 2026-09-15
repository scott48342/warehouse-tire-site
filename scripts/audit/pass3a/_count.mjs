import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const a = await p.query(`select count(*)::int n, count(*) filter (where certification_status='certified')::int cert from vehicle_fitments where source='audit-2026-09-pass3-research'`);
const b = await p.query(`select count(*)::int n from audit_pass3a_inserts`).catch(() => ({ rows: [{ n: "no table" }] }));
const c = await p.query(`select year, make, model, display_trim from vehicle_fitments where source='audit-2026-09-pass3-research' order by make, model, year limit 5`);
console.log("pass3a rows in vehicle_fitments:", a.rows[0].n, "certified:", a.rows[0].cert, "| audit_pass3a_inserts:", b.rows[0].n);
console.log(c.rows.map(r => `${r.year} ${r.make} ${r.model} ${r.display_trim}`).join(" | "));
await p.end();
