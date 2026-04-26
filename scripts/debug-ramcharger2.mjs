import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const dodgeRamcharger = {
  make: 'Dodge',
  models: ['Ramcharger'],
  boltPattern: '5x139.7',
  centerBore: 108,
  fitments: [
    { trims: ['Base', 'SE', 'LE', 'AW150', 'AD150', 'Royal SE', 'Prospector'], yearStart: 1974, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 8, tireSize: 'P235/75R15' },
  ]
};

const allConfigs = [dodgeRamcharger];

function findConfig(make, model) {
  const normalizedMake = make.toLowerCase();
  const normalizedModel = model.toLowerCase();
  
  console.log(`findConfig called: make="${make}" → "${normalizedMake}", model="${model}" → "${normalizedModel}"`);
  
  for (const config of allConfigs) {
    console.log(`  Checking config: make="${config.make}", models=${JSON.stringify(config.models)}`);
    if (config.make.toLowerCase() !== normalizedMake) {
      console.log(`    Make mismatch: ${config.make.toLowerCase()} !== ${normalizedMake}`);
      continue;
    }
    if (config.models.some(m => m.toLowerCase() === normalizedModel)) {
      console.log(`    MATCH! Model found in config.models`);
      return config;
    }
    console.log(`    Model not found in exact match, checking partial...`);
    if (config.models.some(m => normalizedModel.includes(m.toLowerCase()) || m.toLowerCase().includes(normalizedModel))) {
      console.log(`    PARTIAL MATCH!`);
      return config;
    }
  }
  console.log(`  No config found`);
  return null;
}

async function run() {
  const res = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE make = 'Dodge' AND model = 'Ramcharger'
    ORDER BY year
  `);
  
  console.log('Testing findConfig for each Ramcharger record:\n');
  
  for (const r of res.rows) {
    console.log(`Record: ${r.year} ${r.make} ${r.model} "${r.display_trim}"`);
    const config = findConfig(r.make, r.model);
    console.log(`  Config found: ${config ? 'YES' : 'NO'}`);
    console.log('');
  }
  
  await pool.end();
}

run();
