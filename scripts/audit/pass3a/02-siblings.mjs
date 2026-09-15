import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const r = (await p.query(`select year, make, model, display_trim, bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source from vehicle_fitments where quarantined_at is null and ((make='ford' and model in ('f-250','f-350') and year in (1990,1999,2000)) or (make='ford' and model='ranger' and year=1999) or (make='toyota' and model='4runner' and year=1996) or (make='ford' and model='f-150' and year in (1997,1999)) or (make='ford' and model='expedition' and year=1997)) order by make, model, year, display_trim`)).rows;
for (const x of r) console.log(JSON.stringify(x));
await p.end();
