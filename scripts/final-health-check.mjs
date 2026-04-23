import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sql = postgres(process.env.POSTGRES_URL);

console.log('🏥 FINAL HEALTH CHECK\n');
console.log('='.repeat(50));

// Total records
const total = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitments`;
console.log('\n📊 Total Records:', total[0].cnt);

// Unique makes/models
const makes = await sql`SELECT COUNT(DISTINCT make) as cnt FROM vehicle_fitments`;
const models = await sql`SELECT COUNT(DISTINCT model) as cnt FROM vehicle_fitments`;
console.log('📊 Unique Makes:', makes[0].cnt);
console.log('📊 Unique Models:', models[0].cnt);

// Year range
const years = await sql`SELECT MIN(year) as min, MAX(year) as max FROM vehicle_fitments WHERE year >= 2000`;
console.log('📊 Year Range:', years[0].min, '-', years[0].max);

// Data completeness
const complete = await sql`
  SELECT 
    COUNT(*) FILTER (WHERE bolt_pattern IS NOT NULL) as bolt,
    COUNT(*) FILTER (WHERE center_bore_mm IS NOT NULL) as bore,
    COUNT(*) FILTER (WHERE oem_wheel_sizes::text != '[]') as wheels,
    COUNT(*) FILTER (WHERE oem_tire_sizes::text != '[]') as tires,
    COUNT(*) as total
  FROM vehicle_fitments
`;
const c = complete[0];
console.log('\n✅ Data Completeness:');
console.log(`   Bolt Pattern: ${c.bolt}/${c.total} (${(c.bolt/c.total*100).toFixed(1)}%)`);
console.log(`   Center Bore:  ${c.bore}/${c.total} (${(c.bore/c.total*100).toFixed(1)}%)`);
console.log(`   Wheel Sizes:  ${c.wheels}/${c.total} (${(c.wheels/c.total*100).toFixed(1)}%)`);
console.log(`   Tire Sizes:   ${c.tires}/${c.total} (${(c.tires/c.total*100).toFixed(1)}%)`);

// Check for issues
const issues = await sql`
  SELECT 
    COUNT(*) FILTER (WHERE oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]') as no_tires,
    COUNT(*) FILTER (WHERE oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]') as no_wheels,
    COUNT(*) FILTER (WHERE bolt_pattern IS NULL) as no_bolt
  FROM vehicle_fitments
`;
const i = issues[0];

console.log('\n🔍 Issues:');
console.log(`   Missing tires: ${i.no_tires}`);
console.log(`   Missing wheels: ${i.no_wheels}`);
console.log(`   Missing bolt pattern: ${i.no_bolt}`);

// Top makes
const topMakes = await sql`
  SELECT make, COUNT(*) as cnt 
  FROM vehicle_fitments 
  GROUP BY make 
  ORDER BY cnt DESC 
  LIMIT 10
`;
console.log('\n🏆 Top 10 Makes:');
topMakes.forEach((m, idx) => console.log(`   ${idx+1}. ${m.make}: ${m.cnt}`));

console.log('\n' + '='.repeat(50));
if (i.no_tires == 0 && i.no_wheels == 0 && i.no_bolt == 0) {
  console.log('🎉 DATABASE IS 100% COMPLETE! READY FOR PRODUCTION!');
} else {
  console.log('⚠️ Some issues remain.');
}
console.log('='.repeat(50));

await sql.end();
