import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

console.log('🧹 Final straggler cleanup...\n');

// Clean up non-US stragglers that failed tire derivation
const result1 = await sql`DELETE FROM vehicle_fitments WHERE model = 'santro-zip'`;
const result2 = await sql`DELETE FROM vehicle_fitments WHERE model = 'discovery-2'`;
const result3 = await sql`DELETE FROM vehicle_fitments WHERE model = 'spectra-wing'`;

console.log('Cleaned up:');
console.log('  santro-zip (India):', result1.count, 'deleted');
console.log('  discovery-2 (EU name):', result2.count, 'deleted');  
console.log('  spectra-wing (EU):', result3.count, 'deleted');

const total = result1.count + result2.count + result3.count;
console.log('\nTotal removed:', total);

// Final count
const count = await sql`SELECT COUNT(*) as total FROM vehicle_fitments`;
console.log('\n📊 Final database count:', count[0].total, 'records');

// Quick health check
const noTires = await sql`
  SELECT COUNT(*) as cnt FROM vehicle_fitments 
  WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'
`;
console.log('Records still missing tires:', noTires[0].cnt);

await sql.end();
console.log('\n✅ Done!');
