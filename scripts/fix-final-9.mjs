import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sql = postgres(process.env.POSTGRES_URL);

console.log('🔧 Fixing final 9 records...\n');

// Toyota Mega Cruiser - JDM only, delete
const r1 = await sql`DELETE FROM vehicle_fitments WHERE model = 'mega-cruiser'`;
console.log('✅ Deleted Toyota Mega Cruiser (JDM):', r1.count);

// Land Rover Discovery-3 - EU name, delete (we have LR3)
const r2 = await sql`DELETE FROM vehicle_fitments WHERE model = 'discovery-3'`;
console.log('✅ Deleted LR Discovery-3 (EU name):', r2.count);

// Kia Spectra5 - fix with proper tire sizes (205/50R16 was OEM)
const spectraTires = ["195/60R15", "205/50R16"];
const r3 = await sql`
  UPDATE vehicle_fitments 
  SET oem_tire_sizes = ${JSON.stringify(spectraTires)}::jsonb
  WHERE make = 'kia' AND model = 'spectra5'
`;
console.log('✅ Fixed Kia Spectra5 with tire sizes:', r3.count);

// Final check
const stillMissing = await sql`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'
`;
console.log('\n📊 Records still missing tires:', stillMissing[0].cnt);

const total = await sql`SELECT COUNT(*) as total FROM vehicle_fitments`;
console.log('📊 Final total records:', total[0].total);

await sql.end();
console.log('\n✅ All done!');
