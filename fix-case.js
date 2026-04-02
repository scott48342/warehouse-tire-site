const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  
  // Fix make/model case to lowercase for consistency
  const updates = [
    // Makes
    { from: 'Ford', to: 'ford' },
    { from: 'Chevrolet', to: 'chevrolet' },
    { from: 'GMC', to: 'gmc' },
    { from: 'Dodge', to: 'dodge' },
    { from: 'Nissan', to: 'nissan' },
    { from: 'BMW', to: 'bmw' },
    { from: 'Mercedes', to: 'mercedes' },
    { from: 'Subaru', to: 'subaru' },
    { from: 'Toyota', to: 'toyota' },
    { from: 'RAM', to: 'ram' },
  ];

  const modelUpdates = [
    { from: 'Silverado-1500', to: 'silverado-1500' },
    { from: 'Silverado-2500HD', to: 'silverado-2500hd' },
    { from: 'Sierra-2500HD', to: 'sierra-2500hd' },
    { from: 'F-150', to: 'f-150' },
    { from: 'F-250', to: 'f-250' },
    { from: 'F-350', to: 'f-350' },
    { from: 'RAM-1500', to: 'ram-1500' },
    { from: 'Titan', to: 'titan' },
    { from: '5-Series', to: '5-series' },
    { from: 'M3', to: 'm3' },
    { from: 'M5', to: 'm5' },
    { from: 'C-Class', to: 'c-class' },
    { from: 'E-Class', to: 'e-class' },
    { from: 'AMG-GT', to: 'amg-gt' },
    { from: 'Corvette', to: 'corvette' },
    { from: 'Bronco', to: 'bronco' },
    { from: 'WRX', to: 'wrx' },
    { from: 'BRZ', to: 'brz' },
    { from: 'GR86', to: 'gr86' },
    { from: 'GT-R', to: 'gt-r' },
  ];

  console.log('Fixing make casing...');
  for (const { from, to } of updates) {
    const result = await pool.query(`UPDATE vehicle_fitments SET make = $1 WHERE make = $2`, [to, from]);
    if (result.rowCount > 0) {
      console.log(`  ${from} → ${to}: ${result.rowCount} rows`);
    }
  }

  console.log('\nFixing model casing...');
  for (const { from, to } of modelUpdates) {
    const result = await pool.query(`UPDATE vehicle_fitments SET model = $1 WHERE model = $2`, [to, from]);
    if (result.rowCount > 0) {
      console.log(`  ${from} → ${to}: ${result.rowCount} rows`);
    }
  }

  console.log('\nDone!');
  await pool.end();
}

main().catch(console.error);
