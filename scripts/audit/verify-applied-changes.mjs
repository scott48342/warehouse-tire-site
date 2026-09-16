// Verify every audit change set landed in the live DB. Read-only.
//   node --env-file=.env.local scripts/audit/verify-applied-changes.mjs
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
const q = async (s, a = []) => (await p.query(s, a)).rows;
const ok = (b) => (b ? "OK " : "FAIL");
const line = (label, pass, detail) => console.log(`${ok(pass)} ${label}${detail ? "  -- " + detail : ""}`);

console.log("== change-set counts by last_modified_by / source");
for (const r of await q(`select coalesce(last_modified_by,'(none)') who, count(*)::int n, count(*) filter (where quarantined_at is not null) quar, min(updated_at)::date first, max(updated_at)::date last
  from vehicle_fitments where updated_at >= '2026-09-13' group by 1 order by 2 desc`)) console.log(`  ${r.who.padEnd(26)} rows=${String(r.n).padStart(6)} quarantined=${String(r.quar).padStart(5)} ${r.first}..${r.last}`);

console.log("\n== Tire sizes (US AutoForce reconciliation, 09-15)");
const ts = (await q(`select count(*) filter (where tire_sizes_source='usaf') usaf, count(*) filter (where tire_sizes_prev is not null) prev, count(*) live from vehicle_fitments where quarantined_at is null`))[0];
line("usaf-sourced live rows", +ts.usaf > 30000, `${ts.usaf} of ${ts.live}; ${ts.prev} keep prior values in tire_sizes_prev`);

console.log("\n== Pass 3 bolt: roadkill certification (09-15 AM)");
const rk = (await q(`select count(*)::int n from vehicle_fitments where wheel_specs_source='roadkill-xref' and quarantined_at is null`))[0];
line("roadkill-xref rows", rk.n >= 3700, `${rk.n} (expected ~3,780)`);

console.log("\n== Pass 3 bolt: generation-boundary fixes (09-15 PM, cbfc46cf)");
const bf = (await q(`select count(*)::int n, count(distinct (make,model)) np from vehicle_fitments where wheel_specs_source='audit-pass3-bolt-fix'`))[0];
line("audit-pass3-bolt-fix rows", bf.n === 435, `${bf.n} rows / ${bf.np} nameplates (expected 435 / 26)`);
const bq = (await q(`select count(*)::int n from vehicle_fitments where last_modified_by='audit-pass3-bolt-fix' and quarantined_at is not null`))[0];
line("pass3 quarantined dup rows", bq.n === 67, `${bq.n} (expected 67)`);
const spot = [["nissan","xterra",2003,"6x139.7"],["acura","tl",2006,"5x114.3"],["toyota","prius",2010,"5x100"],["cadillac","cts",2005,"5x115"],["honda","pilot",2005,"5x114.3"],["toyota","sequoia",2004,"6x139.7"],["toyota","corolla",2000,"4x100"],["subaru","impreza",2010,"5x100"],["dodge","durango",2006,"5x139.7"],["saturn","ion",2005,"5x110"]];
for (const [mk, md, y, want] of spot) {
  const r = await q(`select array_agg(distinct bolt_pattern) b from vehicle_fitments where make=$1 and model=$2 and year=$3 and quarantined_at is null`, [mk, md, y]);
  line(`${y} ${mk} ${md} = ${want}`, r[0].b?.length === 1 && r[0].b[0] === want, `live bolt values: ${r[0].b?.join("/")}`);
}

console.log("\n== Reddit corrections 09-15 (GS, Astro/Safari, Mustang)");
const gs = await q(`select year, display_trim, oem_wheel_sizes from vehicle_fitments where make='lexus' and model='gs' and year=2011 and quarantined_at is null order by 2`);
line("2011 Lexus GS 350 wheels 17x7.5 / 18x8", gs.some(r => JSON.stringify(r.oem_wheel_sizes).includes('"width":7.5') && JSON.stringify(r.oem_wheel_sizes).includes('"width":8')), gs.map(r => `${r.display_trim}: ${r.oem_wheel_sizes.map(w => w.diameter + "x" + w.width).join("/")}`).join(" | "));
const gsf = (await q(`select count(*)::int n from vehicle_fitments where make='lexus' and model='gs' and year between 2006 and 2015 and display_trim ilike '%GS F%' and quarantined_at is null`))[0];
line("no live 'GS F' rows 2006-2015", gsf.n === 0, `${gsf.n}`);
const astro = await q(`select year, display_trim, bolt_pattern, oem_wheel_sizes from vehicle_fitments where make in ('chevrolet','gmc') and model in ('astro','safari') and quarantined_at is null order by make, year`);
const astroLate = astro.filter(r => r.year >= 2003 && r.year <= 2005), astroEarly = astro.filter(r => r.year < 2003);
line("2003-05 Astro/Safari = 6x139.7", astroLate.length > 0 && astroLate.every(r => r.bolt_pattern === "6x139.7"), `${astroLate.length} rows: ${[...new Set(astroLate.map(r => r.bolt_pattern))].join("/")}`);
line("1990-02 Astro/Safari = 5x127 (incl. AWD)", astroEarly.length > 0 && astroEarly.every(r => r.bolt_pattern === "5x127"), `${astroEarly.length} rows: ${[...new Set(astroEarly.map(r => r.bolt_pattern))].join("/")}`);
line("Safari rows exist 2000-2005", astro.filter(r => r.year >= 2000 && r.year <= 2005 && r.display_trim).length >= 6, `${astro.filter(r => r.year >= 2000).length} rows`);
const astroStr = astro.filter(r => r.oem_wheel_sizes?.some(w => typeof w === "string"));
line("Astro/Safari wheel sizes are objects (resolver-readable)", astroStr.length === 0, astroStr.length ? `${astroStr.length} rows still strings e.g. ${JSON.stringify(astroStr[0].oem_wheel_sizes)}` : "");

console.log("\n== Maverick (09-16, acbc4ea5) vs Tire Guide Pro prints");
const mav = await q(`select year, display_trim, thread_size, offset_min_mm, oem_wheel_sizes, oem_tire_sizes, quarantined_at is not null quar from vehicle_fitments where make='ford' and model='maverick' order by year, quar, display_trim`);
for (const r of mav) console.log(`  ${r.quar ? "QUAR" : "live"} ${r.year} ${r.display_trim.padEnd(26)} ${r.thread_size} +${r.offset_min_mm} ${r.oem_wheel_sizes.map(w => w.diameter + "x" + w.width).join("/")} ${r.oem_tire_sizes.join("/")}`);
const live = mav.filter(r => !r.quar);
line("2021 phantom year gone", !live.some(r => r.year === 2021));
line("2024 has 18 (Lariat, XLT Black Appearance) per TG 2024", live.some(r => r.year === 2024 && r.oem_tire_sizes.includes("225/60R18")));
line("2025-26 have NO 18 per TG 2025", !live.some(r => r.year >= 2025 && r.oem_wheel_sizes.some(w => w.diameter === 18)));
line("2025-26 XLT Black Appearance (19x7.5) present per TG 2025", live.some(r => r.year === 2025 && /black/i.test(r.display_trim)) && live.some(r => r.year === 2026 && /black/i.test(r.display_trim)), "MISSING - to add");
line("all live Maverick M14x1.5 / +37.5", live.every(r => r.thread_size === "M14x1.5" && +r.offset_min_mm === 37.5));
await p.end();
