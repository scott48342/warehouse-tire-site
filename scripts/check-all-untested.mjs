import pg from "pg";
import fs from "fs";
import path from "path";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Load all vehicles
const allData = JSON.parse(fs.readFileSync('C:/Users/Scott-Pc/clawd/warehouse-tire-site/scripts/qa-sweep/data/all-vehicles-PRISMA.json'));
const allVehicles = allData.vehicles;

// Load tested vehicles from results
const resultsDir = 'C:/Users/Scott-Pc/clawd/warehouse-tire-site/scripts/qa-sweep/results';
const tested = new Set();

const files = fs.readdirSync(resultsDir).filter(f => f.startsWith('batch-') && f.endsWith('.json'));
for (const file of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file)));
    if (data.results) {
      for (const r of data.results) {
        tested.add(`${r.year}|${r.make}|${r.model}`);
      }
    }
  } catch (e) {}
}

// Filter untested
const untested = allVehicles.filter(v => !tested.has(`${v.year}|${v.make}|${v.model}`));

console.log(`Total vehicles: ${allVehicles.length}`);
console.log(`Already tested: ${tested.size}`);
console.log(`Remaining untested: ${untested.length}\n`);
console.log(`Checking all ${untested.length} untested vehicles...\n`);

const issues = {
  notInDb: [],
  noBoltPattern: [],
  noTireSizes: [],
  emptyTireSizes: [],
};

// Group by make for better reporting
const missingByMake = {};

try {
  let checked = 0;
  for (const v of untested) {
    const { rows } = await pool.query(`
      SELECT bolt_pattern, oem_tire_sizes, display_trim
      FROM vehicle_fitments 
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
      LIMIT 1
    `, [v.year, v.make, v.model]);
    
    if (rows.length === 0) {
      issues.notInDb.push(`${v.year} ${v.make} ${v.model}`);
      missingByMake[v.make] = (missingByMake[v.make] || 0) + 1;
    } else {
      const row = rows[0];
      if (!row.bolt_pattern || row.bolt_pattern.trim() === '') {
        issues.noBoltPattern.push(`${v.year} ${v.make} ${v.model}`);
      }
      if (!row.oem_tire_sizes) {
        issues.noTireSizes.push(`${v.year} ${v.make} ${v.model}`);
      } else if (Array.isArray(row.oem_tire_sizes) && row.oem_tire_sizes.length === 0) {
        issues.emptyTireSizes.push(`${v.year} ${v.make} ${v.model}`);
      } else if (typeof row.oem_tire_sizes === 'object' && Object.keys(row.oem_tire_sizes).length === 0) {
        issues.emptyTireSizes.push(`${v.year} ${v.make} ${v.model}`);
      }
    }
    
    checked++;
    if (checked % 500 === 0) {
      console.log(`Progress: ${checked}/${untested.length}...`);
    }
  }
  
  console.log('\n=== FULL FITMENT DATA QUALITY REPORT ===\n');
  console.log(`Total untested vehicles: ${untested.length}`);
  console.log(`Not in DB: ${issues.notInDb.length}`);
  console.log(`No bolt pattern: ${issues.noBoltPattern.length}`);
  console.log(`No tire sizes (null): ${issues.noTireSizes.length}`);
  console.log(`Empty tire sizes ([] or {}): ${issues.emptyTireSizes.length}`);
  
  const problemCount = issues.notInDb.length + issues.noBoltPattern.length;
  const goodCount = untested.length - problemCount;
  console.log(`\n✅ Good fitments: ${goodCount} (${(goodCount/untested.length*100).toFixed(1)}%)`);
  console.log(`⚠️  Problem fitments: ${problemCount} (${(problemCount/untested.length*100).toFixed(1)}%)`);
  
  if (Object.keys(missingByMake).length > 0) {
    console.log('\n--- MISSING BY MAKE ---');
    const sorted = Object.entries(missingByMake).sort((a, b) => b[1] - a[1]);
    for (const [make, count] of sorted) {
      console.log(`  ${make}: ${count}`);
    }
  }
  
  if (issues.noBoltPattern.length > 0) {
    console.log('\n--- MISSING BOLT PATTERN (all) ---');
    issues.noBoltPattern.forEach(v => console.log(`  ${v}`));
  }
  
  if (issues.emptyTireSizes.length > 0) {
    console.log('\n--- EMPTY TIRE SIZES (all) ---');
    issues.emptyTireSizes.forEach(v => console.log(`  ${v}`));
  }
  
  if (issues.notInDb.length > 0 && issues.notInDb.length <= 50) {
    console.log('\n--- NOT IN DATABASE (all) ---');
    issues.notInDb.forEach(v => console.log(`  ${v}`));
  } else if (issues.notInDb.length > 50) {
    console.log('\n--- NOT IN DATABASE (first 50) ---');
    issues.notInDb.slice(0, 50).forEach(v => console.log(`  ${v}`));
    console.log(`  ... and ${issues.notInDb.length - 50} more`);
  }
  
} finally {
  await pool.end();
}
