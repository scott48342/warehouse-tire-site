import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

console.log('🧹 Deep cleanup - removing records with no wheel/tire data...\n');

// First, let's see the breakdown
const stats = await sql`
  SELECT 
    COUNT(*) FILTER (WHERE (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]') 
                     AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')) as no_data,
    COUNT(*) FILTER (WHERE oem_wheel_sizes::text != '[]' 
                     AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')) as wheels_only,
    COUNT(*) FILTER (WHERE oem_wheel_sizes::text != '[]' AND oem_tire_sizes::text != '[]') as complete
  FROM vehicle_fitments
`;

console.log('Current state:');
console.log('  No data (empty wheels + tires):', stats[0].no_data);
console.log('  Wheels only (no tires):', stats[0].wheels_only);
console.log('  Complete:', stats[0].complete);

// Delete records with NO data at all - these are useless
const result1 = await sql`
  DELETE FROM vehicle_fitments 
  WHERE (oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]')
    AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
`;
console.log('\n✅ Deleted records with no wheel/tire data:', result1.count);

// Clean up remaining phantom entries
console.log('\n🔧 Cleaning up remaining phantom entries...');

// Buick Park Avenue post-2005
const r2 = await sql`DELETE FROM vehicle_fitments WHERE make = 'buick' AND model = 'park-avenue' AND year > 2005`;
console.log('  Buick Park Avenue post-2005:', r2.count);

// Land Rover Discovery 5 (EU name for Discovery)
const r3 = await sql`DELETE FROM vehicle_fitments WHERE model = 'discovery-5'`;
console.log('  Land Rover Discovery-5 (EU):', r3.count);

// Infiniti generic names
const r4 = await sql`DELETE FROM vehicle_fitments WHERE make = 'infiniti' AND model IN ('g', 'm', 'i', 'ex', 'fx')`;
console.log('  Infiniti generic names:', r4.count);

// Final stats
const final = await sql`SELECT COUNT(*) as total FROM vehicle_fitments`;
const stillMissing = await sql`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]'
`;

console.log('\n📊 Final state:');
console.log('  Total records:', final[0].total);
console.log('  Still missing tires:', stillMissing[0].cnt);

await sql.end();
console.log('\n✅ Deep cleanup complete!');
