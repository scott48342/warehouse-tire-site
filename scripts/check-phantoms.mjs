import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.POSTGRES_URL);

console.log("Checking for phantom model years...\n");

// Known phantom year checks
const checks = [
  { make: 'cadillac', model: 'srx', badYears: [2017, 2018, 2019, 2020] },
  { make: 'cadillac', model: 'sts-v', badYears: [2004, 2005] },
  { make: 'cadillac', model: 'xt5', badYears: [2015, 2016] },
  { make: 'cadillac', model: 'xt6', badYears: [2018, 2019] },
  { make: 'chrysler', model: '300c', badYears: [2004] },
  { make: 'mitsubishi', model: '3000 gt', badYears: [2000, 2001] },
  { make: 'mitsubishi', model: 'galant', badYears: [2013, 2014, 2015] },
  { make: 'mitsubishi', model: 'diamante', badYears: [2005, 2006] },
  { make: 'bmw', model: 'x1', badYears: [2009, 2010, 2011, 2012] },
  { make: 'bmw', model: 'z3', badYears: [2003, 2004, 2005] },
  { make: 'audi', model: 'q3', badYears: [2011, 2012, 2013, 2014] },
  { make: 'audi', model: 'rs3', badYears: [2011, 2012, 2015, 2016] },
  { make: 'mini', model: 'cooper', badYears: [2000, 2001] },
  { make: 'toyota', model: 'fj cruiser', badYears: [2015, 2016, 2017, 2018] },
  { make: 'nissan', model: 'gt-r', badYears: [2007] },
  { make: 'hyundai', model: 'entourage', badYears: [2010, 2011] },
  { make: 'honda', model: 'fit', badYears: [2001, 2002, 2003, 2004, 2005, 2006, 2022, 2023, 2024] },
  { make: 'volkswagen', model: 'touareg', badYears: [2002] },
  { make: 'porsche', model: '918', badYears: [2013, 2016, 2017] },
];

let foundIssues = 0;

for (const check of checks) {
  const results = await sql`
    SELECT year, make, model 
    FROM vehicle_fitments 
    WHERE make = ${check.make} 
      AND model LIKE ${check.model + '%'}
      AND year = ANY(${check.badYears})
  `;
  
  if (results.length > 0) {
    foundIssues += results.length;
    console.log(`❌ Found phantom entries for ${check.make} ${check.model}:`);
    results.forEach(r => console.log(`   ${r.year} ${r.make} ${r.model}`));
  }
}

// Also check for some of the known wrong badge issues
console.log("\nChecking for wrong badges...\n");

const wrongBadges = [
  { make: 'honda', model: 'nsx' },
  { make: 'honda', model: 'mdx' },
  { make: 'gmc', model: 'suburban' },
  { make: 'hyundai', model: 'tuscani' },
  { make: 'hyundai', model: 'jm' },
  { make: 'hyundai', model: 'nf' },
  { make: 'infiniti', model: 'q30' },
];

for (const check of wrongBadges) {
  const results = await sql`
    SELECT COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE make = ${check.make} AND model = ${check.model}
  `;
  
  if (parseInt(results[0].cnt) > 0) {
    foundIssues += parseInt(results[0].cnt);
    console.log(`❌ Found ${results[0].cnt} wrong badge entries: ${check.make} ${check.model}`);
  }
}

console.log("\n" + "=".repeat(50));
if (foundIssues === 0) {
  console.log("✅ Database is clean! No phantom years or wrong badges found.");
} else {
  console.log(`⚠️  Found ${foundIssues} issues that need cleanup.`);
}
console.log("=".repeat(50));

await sql.end();
