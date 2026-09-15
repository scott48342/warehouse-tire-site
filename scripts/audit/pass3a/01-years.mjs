import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, v) => (await p.query(s, v)).rows;
const T = (rows) => rows.map((r) => Object.values(r).map(x=>typeof x==='object'?JSON.stringify(x):x).join(" | ")).join("\n");
const targets = [['ford','f-150'],['ford','f-250'],['ford','f-350'],['ford','ranger'],['toyota','camry'],['toyota','4runner'],['toyota','tacoma'],['chevrolet','suburban'],['chevrolet','tahoe'],['gmc','yukon'],['gmc','suburban'],['chevrolet','c/k-1500'],['gmc','c/k-1500'],['chevrolet','c1500'],['chevrolet','k1500'],['chevrolet','c2500'],['chevrolet','k2500'],['chevrolet','c3500'],['chevrolet','k3500'],['gmc','sierra'],['gmc','sierra-1500'],['gmc','sierra-2500hd'],['gmc','sierra-3500hd'],['dodge','ram-1500'],['dodge','ram-2500'],['dodge','ram-3500'],['ram','2500'],['ram','3500']];
console.log("=== active years 1989-1999 per target slug ===");
for (const [mk, md] of targets) {
  const r = await q(`select year, count(*)::int n, string_agg(display_trim, ' / ' order by display_trim) trims from vehicle_fitments where make=$1 and model=$2 and year between 1989 and 1999 and quarantined_at is null group by year order by year`, [mk, md]);
  console.log(`\n${mk} ${md}:`); console.log(T(r) || '  (none)');
}
console.log("\n=== sample rows ===");
const samples = await q(`select year, make, model, modification_id, raw_trim, display_trim, submodel, bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes, source, quality_tier, certification_status, confidence_tag, is_locked, last_modified_by, last_modified_reason from vehicle_fitments where quarantined_at is null and ((make='ford' and model='f-150' and year in (1991,2000)) or (make='toyota' and model='tacoma' and year=1997) or (make='dodge' and model='ram-1500' and year=1996) or (make='chevrolet' and model='c1500' and year=1995) or (make='chevrolet' and model='c/k-1500' and year=1995) or (make='toyota' and model='camry' and year in (1991,2000)) or (make='toyota' and model='4runner' and year in (1990,2000)) or (make='chevrolet' and model='suburban' and year in (1991,2000)) or (make='ford' and model='ranger' and year in (1992,2000))) order by make, model, year`);
for (const s of samples) console.log(JSON.stringify(s));
await p.end();
