/**
 * Check for fake vehicle entries (year/make/model combos that don't exist)
 * 
 * Run: node scripts/check-fake-vehicles.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Known vehicle launch years (when they ACTUALLY started production)
const launchYears = {
  'Tesla': { 'Cybertruck': 2024, 'Model S': 2012, 'Model 3': 2017, 'Model X': 2015, 'Model Y': 2020 },
  'Cadillac': { 'CT4': 2020, 'CT5': 2020, 'Lyriq': 2023, 'XT4': 2019, 'CT6': 2016 },
  'Genesis': { 'G70': 2018, 'G80': 2017, 'G90': 2017, 'GV70': 2021, 'GV80': 2021, 'GV60': 2022 },
  'Volkswagen': { 'Arteon': 2019, 'Atlas': 2018, 'Atlas Cross Sport': 2020, 'ID.4': 2021, 'Taos': 2022 },
  'Kia': { 'Seltos': 2020, 'Telluride': 2020, 'EV6': 2022, 'Carnival': 2022, 'K5': 2021 },
  'Hyundai': { 'Palisade': 2020, 'Venue': 2020, 'Ioniq 5': 2022, 'Ioniq 6': 2023, 'Santa Cruz': 2022 },
  'Ford': { 'Bronco': 2021, 'Bronco Sport': 2021, 'Maverick': 2022, 'Mustang Mach-E': 2021, 'F-150 Lightning': 2022 },
  'Chevrolet': { 'Trailblazer': 2021, 'Blazer EV': 2024, 'Equinox EV': 2024, 'Silverado EV': 2024 },
  'GMC': { 'Hummer EV': 2022 },
  'Toyota': { 'GR Supra': 2020, 'GR86': 2022, 'bZ4X': 2023, 'Crown': 2023, 'Grand Highlander': 2024, 'Corolla Cross': 2022 },
  'Subaru': { 'Solterra': 2023 },
  'Honda': { 'Prologue': 2024, 'HR-V': 2016 },
  'Acura': { 'ZDX': 2024 },
  'Rivian': { 'R1T': 2022, 'R1S': 2022 },
  'Lucid': { 'Air': 2022 },
  'Polestar': { '2': 2021, '3': 2024 },
  'BMW': { 'iX': 2022, 'i4': 2022, 'i5': 2024, 'i7': 2023, 'XM': 2023 },
  'Mercedes-Benz': { 'EQS': 2022, 'EQE': 2023, 'EQB': 2022 },
  'Audi': { 'Q4 e-tron': 2022, 'e-tron GT': 2022, 'Q8 e-tron': 2023 },
  'Lexus': { 'RZ': 2023, 'TX': 2024, 'LX': 2022 },
  'Mazda': { 'CX-50': 2023, 'CX-90': 2024, 'CX-30': 2020 },
  'Nissan': { 'Ariya': 2023, 'Z': 2023 },
  'Jeep': { 'Grand Wagoneer': 2022, 'Wagoneer': 2022 },
  'Lincoln': { 'Nautilus': 2019 },
  'Infiniti': { 'QX55': 2021 }
};

async function findFakes() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(`
      SELECT DISTINCT year, make, model 
      FROM vehicle_fitments 
      ORDER BY make, model, year
    `);
    
    const vehicles = result.rows;
    console.log(`Total unique year/make/model combos in DB: ${vehicles.length}`);
    
    const fakes = [];
    for (const v of vehicles) {
      const makeLaunch = launchYears[v.make];
      if (makeLaunch && makeLaunch[v.model]) {
        const minYear = makeLaunch[v.model];
        if (v.year < minYear) {
          fakes.push({ year: v.year, make: v.make, model: v.model, minYear });
        }
      }
    }
    
    console.log(`\nFound ${fakes.length} FAKE vehicle entries:\n`);
    
    // Group by make/model for cleaner output
    const grouped = {};
    for (const f of fakes) {
      const key = `${f.make} ${f.model}`;
      if (!grouped[key]) grouped[key] = { minYear: f.minYear, fakeYears: [] };
      grouped[key].fakeYears.push(f.year);
    }
    
    for (const [name, data] of Object.entries(grouped)) {
      console.log(`${name} (actually started ${data.minYear}):`);
      console.log(`  Fake years: ${data.fakeYears.sort((a,b) => a-b).join(', ')}\n`);
    }
    
    // Count total fake entries (including all trims)
    if (fakes.length > 0) {
      const fakeConditions = fakes.map(f => 
        `(year = ${f.year} AND make = '${f.make.replace(/'/g, "''")}' AND model = '${f.model.replace(/'/g, "''")}')`
      ).join(' OR ');
      
      const countResult = await pool.query(`
        SELECT COUNT(*) as count FROM vehicle_fitments 
        WHERE ${fakeConditions}
      `);
      console.log(`\nTotal fitment ROWS with fake vehicles: ${countResult.rows[0].count}`);
    }
    
  } finally {
    await pool.end();
  }
}

findFakes().catch(console.error);
