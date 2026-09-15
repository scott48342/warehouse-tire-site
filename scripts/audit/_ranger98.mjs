import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const r = await p.query(`select display_trim, bolt_pattern, thread_size, oem_wheel_sizes, oem_tire_sizes, certification_status from vehicle_fitments where make='ford' and model='ranger' and year=1998 and quarantined_at is null order by display_trim`);
for (const x of r.rows) console.log(x.display_trim, "|", x.bolt_pattern, x.thread_size, "| wheels", JSON.stringify((x.oem_wheel_sizes || []).map(w => w.diameter + "x" + w.width)), "| tires", JSON.stringify(x.oem_tire_sizes), "|", x.certification_status);
await p.end();
