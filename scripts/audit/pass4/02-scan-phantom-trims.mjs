// Pass 4 / step 2a: find trim names that appear on model-years BEFORE the trim existed (or on models that never had them).
// Method: for each (make, model), take each distinct display_trim; record first/last DB year and sources. Flag when the trim
// token appears only from bulk import sources (cache-import*, api_import*, catalog-gap-fill) on years before the same token
// appears from a trusted source for that model, OR matches a curated introduction-year table.
//   node --env-file=.env.local scripts/audit/pass4/02-scan-phantom-trims.mjs   -> docs/fitment-api/audit/pass4/phantom-trim-candidates.csv
import fs from "node:fs";
import pg from "pg";
const p = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
// Curated: trim token -> { make?, model?, firstYear } (US market). Token matched case-insensitively as a whole word in display_trim.
const INTRO = [
  { make: "honda", token: "TrailSport", first: 2022 }, { make: "honda", token: "Elite", first: 2016 }, { make: "honda", model: "pilot", token: "Touring", first: 2009 }, { make: "honda", token: "Black Edition", first: 2017 },
  { make: "acura", model: "tl", token: "SH-AWD", first: 2009 }, { make: "acura", model: "mdx", token: "SH-AWD", first: 2007 }, { make: "acura", model: "rl", token: "SH-AWD", first: 2005 }, { make: "acura", token: "A-Spec", first: 2018 }, { make: "acura", model: "mdx", token: "Technology", first: 2007 }, { make: "acura", model: "rdx", token: "Technology", first: 2007 }, { make: "acura", model: "mdx", token: "Advance", first: 2010 }, { make: "acura", model: "rdx", token: "Advance", first: 2013 }, { make: "acura", token: "Advance", first: 2009, exceptModels: ["mdx", "rdx"] }, { make: "acura", token: "Technology", first: 2009, exceptModels: ["mdx", "rdx"] }, { make: "acura", token: "Type S", first: 2021, exceptModels: ["tl", "cl", "rsx", "integra", "tlx"] },
  { make: "toyota", token: "XSE", first: 2015 }, { make: "toyota", model: "corolla", token: "XSE", first: 2017 }, { make: "toyota", model: "prius", token: "XLE", first: 2019 }, { make: "toyota", model: "prius", token: "Limited", first: 2019 }, { make: "toyota", model: "prius", token: "LE", first: 2019 }, { make: "toyota", token: "TRD Pro", first: 2015 }, { make: "toyota", token: "TRD Off-Road", first: 2016, exceptModels: ["tundra", "tacoma"] }, { make: "toyota", token: "Nightshade", first: 2019 }, { make: "toyota", token: "Platinum", first: 2005 },
  { make: "nissan", model: "altima", token: "SV", first: 2013 }, { make: "nissan", model: "altima", token: "SR", first: 2010 }, { make: "nissan", model: "altima", token: "Platinum", first: 2019 }, { make: "nissan", token: "Midnight Edition", first: 2017 }, { make: "nissan", token: "Rock Creek", first: 2019 }, { make: "nissan", token: "PRO-4X", first: 2005 },
  { make: "lexus", token: "F Sport", first: 2011 }, { make: "lexus", model: "es", token: "300h", first: 2013 }, { make: "lexus", model: "es", token: "350", first: 2007 }, { make: "lexus", model: "es", token: "250", first: 1990, last: 1991 }, { make: "lexus", model: "es", token: "330", first: 2004, last: 2006 }, { make: "lexus", model: "es", token: "300", first: 1992, last: 2003 },
  { make: "buick", token: "Avenir", first: 2018 }, { make: "buick", token: "Essence", first: 2018 }, { make: "buick", token: "Preferred", first: 2018 }, { make: "buick", token: "Sport Touring", first: 2017 },
  { make: "subaru", model: "wrx", token: "GT", first: 2022 }, { make: "subaru", token: "Wilderness", first: 2022 }, { make: "subaru", token: "Onyx", first: 2020 }, { make: "subaru", model: "forester", token: "Touring", first: 2014 }, { make: "subaru", token: "Touring", first: 2015, exceptModels: ["forester"] },
  { make: "ford", token: "Tremor", first: 2020 }, { make: "ford", token: "Timberline", first: 2021 }, { make: "ford", token: "Platinum", first: 2009 }, { make: "ford", token: "King Ranch", first: 2001 }, { make: "ford", token: "Raptor", first: 2010 }, { make: "ford", token: "ST-Line", first: 2020 }, { make: "ford", token: "Lightning", first: 1993 }, { make: "ford", token: "Dark Horse", first: 2024 }, { make: "ford", token: "Mach 1", first: 1969 }, { make: "ford", token: "Bullitt", first: 2001 },
  { make: "chevrolet", token: "High Country", first: 2014 }, { make: "chevrolet", token: "RST", first: 2018 }, { make: "chevrolet", token: "Trail Boss", first: 2019 }, { make: "chevrolet", token: "ZR2", first: 2017 }, { make: "chevrolet", token: "Premier", first: 2016 }, { make: "chevrolet", token: "Midnight Edition", first: 2015 }, { make: "chevrolet", token: "Redline", first: 2018 }, { make: "chevrolet", token: "Activ", first: 2017 },
  { make: "gmc", token: "AT4", first: 2019 }, { make: "gmc", token: "Denali Ultimate", first: 2022 }, { make: "gmc", token: "Elevation", first: 2016 }, { make: "gmc", token: "Denali", first: 1999 },
  { make: "ram", token: "Rebel", first: 2015 }, { make: "ram", token: "Limited", first: 2015 }, { make: "ram", token: "TRX", first: 2021 }, { make: "ram", token: "Warlock", first: 2019 }, { make: "ram", token: "Night Edition", first: 2017 },
  { make: "jeep", token: "Trailhawk", first: 2013 }, { make: "jeep", token: "Trackhawk", first: 2018 }, { make: "jeep", token: "High Altitude", first: 2012 }, { make: "jeep", token: "Rubicon", first: 2003 }, { make: "jeep", token: "Mojave", first: 2020 }, { make: "jeep", token: "4xe", first: 2021 }, { make: "jeep", token: "Summit", first: 2011 }, { make: "jeep", token: "392", first: 2021 },
  { make: "dodge", token: "Scat Pack", first: 2015 }, { make: "dodge", token: "Hellcat", first: 2015 }, { make: "dodge", token: "Widebody", first: 2018 }, { make: "dodge", token: "Demon", first: 2018 }, { make: "dodge", token: "Redeye", first: 2019 },
  { make: "hyundai", token: "N Line", first: 2019 }, { make: "hyundai", token: "Calligraphy", first: 2020 }, { make: "hyundai", token: "Ultimate", first: 2015 }, { make: "hyundai", token: "XRT", first: 2022 },
  { make: "kia", token: "GT-Line", first: 2019 }, { make: "kia", token: "X-Line", first: 2021 }, { make: "kia", token: "X-Pro", first: 2022 }, { make: "kia", token: "SX Prestige", first: 2019 },
  { make: "mazda", token: "Carbon Edition", first: 2021 }, { make: "mazda", token: "Signature", first: 2016 }, { make: "mazda", token: "Turbo", first: 2019, exceptModels: ["mazdaspeed3", "mazdaspeed6", "rx-7", "cx-7", "cx-9", "mx-6", "323", "626"] },
  { make: "volkswagen", token: "R-Line", first: 2012 }, { make: "volkswagen", token: "SEL Premium", first: 2015 }, { make: "volkswagen", token: "Autobahn", first: 2015 },
  { make: "bmw", model: "m5", token: "Competition", first: 2013 }, { make: "bmw", model: "m3", token: "Competition", first: 2011 }, { make: "bmw", token: "Competition", first: 2016, exceptModels: ["m3", "m5"] },
  { make: "mercedes-benz", token: "4MATIC", first: 1998 }, { make: "mercedes-benz", token: "AMG Line", first: 2015 },
  { make: "audi", token: "Prestige", first: 2009 }, { make: "audi", token: "Premium Plus", first: 2009 }, { make: "audi", token: "S line", first: 2005 },
  { make: "cadillac", token: "V-Series", first: 2004 }, { make: "cadillac", token: "Blackwing", first: 2022 }, { make: "cadillac", token: "Platinum", first: 2008 }, { make: "cadillac", token: "Sport", first: 2016 },
  { make: "lincoln", token: "Black Label", first: 2015 }, { make: "lincoln", token: "Reserve", first: 2015 }, { make: "lincoln", token: "Grand Touring", first: 2020 },
  { make: "volvo", token: "R-Design", first: 2008 }, { make: "volvo", token: "Inscription", first: 2015 }, { make: "volvo", token: "Polestar", first: 2015 }, { make: "volvo", token: "Cross Country", first: 1998 },
  { make: "genesis", token: "Sport Prestige", first: 2021 },
  { make: "tesla", token: "Plaid", first: 2021 }, { make: "tesla", token: "Performance", first: 2014 },
];
const rows = (await p.query(`select id, year, make, model, display_trim, source from vehicle_fitments where quarantined_at is null and display_trim is not null and display_trim <> '' and source is distinct from 'tgp_solutions'`)).rows;
const out = [["id", "year", "make", "model", "display_trim", "source", "rule", "first_valid_year"]];
let n = 0;
for (const r of rows) {
  for (const rule of INTRO) {
    if (rule.make !== r.make) continue;
    if (rule.model && rule.model !== r.model) continue;
    if (rule.exceptModels?.includes(r.model)) continue;
    const re = new RegExp(`(^|[^A-Za-z0-9])${rule.token.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&")}($|[^A-Za-z0-9])`, "i");
    if (!re.test(r.display_trim)) continue;
    if (r.year < rule.first || (rule.last && r.year > rule.last)) {
      out.push([r.id, r.year, r.make, r.model, r.display_trim, r.source, `${rule.token}${rule.model ? " on " + rule.model : ""} exists ${rule.first}${rule.last ? "-" + rule.last : "+"}`, rule.first].map(v => `"${String(v).replace(/"/g, '""')}"`));
      n++; break;
    }
  }
}
fs.mkdirSync("docs/fitment-api/audit/pass4", { recursive: true });
fs.writeFileSync("docs/fitment-api/audit/pass4/phantom-trim-candidates.csv", out.map(r => r.join(",")).join("\n"));
console.log(`${n} candidate rows -> docs/fitment-api/audit/pass4/phantom-trim-candidates.csv`);
const agg = {};
for (const r of out.slice(1)) { const k = `${r[2]} ${r[3]}: ${r[6]}`.replace(/"/g, ""); agg[k] ??= { n: 0, ys: new Set(), src: new Set() }; agg[k].n++; agg[k].ys.add(+r[1].replace(/"/g, "")); agg[k].src.add(r[5].replace(/"/g, "")); }
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].n - a[1].n)) { const ys = [...v.ys].sort(); console.log(`  ${String(v.n).padStart(4)}  ${k.padEnd(70)} ours ${ys[0]}-${ys[ys.length - 1]}  [${[...v.src].join(", ")}]`); }
await p.end();

