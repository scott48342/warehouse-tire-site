const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fix() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  const updates = [
    ['audi', 'q5', 'Base', 'Premium, Premium Plus, Prestige, SQ5, SQ5 Sportback'],
    ['audi', 'q7', 'Base', 'Premium, Premium Plus, Prestige, SQ7'],
    ['toyota', '4runner', 'Base', 'SR5, TRD Off-Road, TRD Pro, Limited, Nightshade'],
    ['toyota', 'tundra', 'Base', 'SR, SR5, Limited, Platinum, 1794, TRD Pro'],
    ['toyota', 'avalon', 'Base', 'XLE, XSE, Touring, Limited, TRD'],
    ['toyota', 'camry', 'Base', 'LE, SE, XLE, XSE, TRD'],
    ['mazda', 'cx-5', 'Base', 'S, Select, Preferred, Carbon Edition, Premium, Turbo, Signature'],
    ['mazda', 'cx-9', 'Base', 'Sport, Touring, Carbon Edition, Grand Touring, Signature'],
    ['scion', 'tc', 'Base', 'Base, Release Series'],
    ['scion', 'xb', 'Base', 'Base, Release Series'],
    ['scion', 'fr-s', 'Base', 'Base, Release Series'],
  ];
  
  let total = 0;
  for (const [make, model, oldTrim, newTrim] of updates) {
    const r = await pool.query(
      'UPDATE vehicle_fitments SET display_trim = $1 WHERE make = $2 AND model = $3 AND display_trim = $4 RETURNING id',
      [newTrim, make, model, oldTrim]
    );
    if (r.rowCount > 0) {
      console.log(`${make} ${model}: ${r.rowCount}`);
      total += r.rowCount;
    }
  }
  
  console.log(`\nTotal updated: ${total}`);
  await pool.end();
}

fix();
