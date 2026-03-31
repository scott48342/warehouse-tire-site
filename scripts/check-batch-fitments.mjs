import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Load vehicles from phase 7, 8, 9 batches
const batches = [
  'C:/Users/Scott-Pc/clawd/warehouse-tire-site/scripts/qa-sweep/results-prisma/phase-7-batch.json',
  'C:/Users/Scott-Pc/clawd/warehouse-tire-site/scripts/qa-sweep/results-prisma/phase-8-batch.json',
  'C:/Users/Scott-Pc/clawd/warehouse-tire-site/scripts/qa-sweep/results-prisma/phase-9-batch.json',
];

const vehicles = [];
for (const batch of batches) {
  try {
    const data = JSON.parse(fs.readFileSync(batch));
    vehicles.push(...data);
  } catch (e) {
    console.error(`Failed to load ${batch}:`, e.message);
  }
}

console.log(`Checking ${vehicles.length} vehicles from phases 7-9...\n`);

const issues = {
  notInDb: [],
  noBoltPattern: [],
  noTireSizes: [],
  emptyTireSizes: [],
};

try {
  for (const v of vehicles) {
    const { rows } = await pool.query(`
      SELECT bolt_pattern, oem_tire_sizes, display_trim
      FROM vehicle_fitments 
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
      LIMIT 1
    `, [v.year, v.make, v.model]);
    
    if (rows.length === 0) {
      issues.notInDb.push(`${v.year} ${v.make} ${v.model}`);
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
  }
  
  console.log('=== FITMENT DATA QUALITY REPORT ===\n');
  console.log(`Total vehicles checked: ${vehicles.length}`);
  console.log(`Not in DB: ${issues.notInDb.length}`);
  console.log(`No bolt pattern: ${issues.noBoltPattern.length}`);
  console.log(`No tire sizes (null): ${issues.noTireSizes.length}`);
  console.log(`Empty tire sizes ([] or {}): ${issues.emptyTireSizes.length}`);
  
  const goodCount = vehicles.length - issues.notInDb.length - issues.noBoltPattern.length;
  console.log(`\n✅ Good fitments: ${goodCount} (${(goodCount/vehicles.length*100).toFixed(1)}%)`);
  
  if (issues.notInDb.length > 0) {
    console.log('\n--- NOT IN DATABASE (top 20) ---');
    issues.notInDb.slice(0, 20).forEach(v => console.log(`  ${v}`));
    if (issues.notInDb.length > 20) console.log(`  ... and ${issues.notInDb.length - 20} more`);
  }
  
  if (issues.noBoltPattern.length > 0) {
    console.log('\n--- MISSING BOLT PATTERN (top 20) ---');
    issues.noBoltPattern.slice(0, 20).forEach(v => console.log(`  ${v}`));
    if (issues.noBoltPattern.length > 20) console.log(`  ... and ${issues.noBoltPattern.length - 20} more`);
  }
  
  if (issues.emptyTireSizes.length > 0) {
    console.log('\n--- EMPTY TIRE SIZES (top 20) ---');
    issues.emptyTireSizes.slice(0, 20).forEach(v => console.log(`  ${v}`));
    if (issues.emptyTireSizes.length > 20) console.log(`  ... and ${issues.emptyTireSizes.length - 20} more`);
  }
  
} finally {
  await pool.end();
}
