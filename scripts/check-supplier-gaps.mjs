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

const vehicles = [
  { year: 2005, make: 'Chrysler', model: '300C' },
  { year: 2010, make: 'Ford', model: 'Mustang' },
  { year: 2021, make: 'Ford', model: 'Mustang' },
  { year: 2022, make: 'Toyota', model: 'Sienna' }
];

try {
  console.log("Tire sizes in DB for failed vehicles:\n");
  
  for (const v of vehicles) {
    const { rows } = await pool.query(`
      SELECT display_trim, oem_tire_sizes 
      FROM vehicle_fitments 
      WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
      LIMIT 3
    `, [v.year, v.make, v.model]);
    
    console.log(`${v.year} ${v.make} ${v.model}:`);
    for (const row of rows) {
      console.log(`  Trim: ${row.display_trim || '(base)'}`);
      const sizes = row.oem_tire_sizes;
      if (sizes && Object.keys(sizes).length > 0) {
        Object.entries(sizes).forEach(([k, val]) => {
          console.log(`    ${k}: ${JSON.stringify(val)}`);
        });
      } else {
        console.log('    oem_tire_sizes = {} (empty)');
      }
    }
    if (rows.length === 0) {
      console.log('  (no records found)');
    }
    console.log('');
  }
  
  // Now let's see what sizes ARE in supplier inventory
  console.log("\n--- Checking supplier inventory (wp_tires) ---\n");
  
  const testSizes = [
    "225/60R18", "245/45R20", // Chrysler 300C
    "235/50R18", "245/45R19", // 2010 Mustang  
    "235/55R17", "255/40R19", "265/40R19", // 2021 Mustang
    "235/60R18", "235/55R19", "235/50R20" // Sienna
  ];
  
  for (const size of testSizes) {
    const match = size.match(/(\d+)\/(\d+)R(\d+)/);
    if (!match) continue;
    const [_, width, aspect, diameter] = match;
    
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count
      FROM wp_tires
      WHERE section_width = $1 AND series = $2 AND rim_diameter_in = $3
    `, [width, aspect, diameter]);
    
    const count = parseInt(rows[0].count);
    const status = count > 0 ? '✅' : '❌';
    console.log(`${size}: ${status} ${count} tires`);
  }
  
} finally {
  await pool.end();
}
