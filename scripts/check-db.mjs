import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.POSTGRES_URL);

const count = await sql`SELECT COUNT(*) as total FROM vehicle_fitments`;
console.log('Total rows in vehicle_fitments:', count[0].total);

const makes = await sql`SELECT DISTINCT make, COUNT(*) as cnt FROM vehicle_fitments GROUP BY make ORDER BY cnt DESC LIMIT 20`;
console.log('\nTop makes:');
makes.forEach(m => console.log(`  ${m.make}: ${m.cnt}`));

const samples = await sql`SELECT year, make, model FROM vehicle_fitments ORDER BY make, model LIMIT 15`;
console.log('\nSample rows:');
samples.forEach(s => console.log(`  ${s.year} ${s.make} ${s.model}`));

// Check for any of the specific models we tried to delete
const testModels = await sql`
  SELECT DISTINCT make, model, COUNT(*) as cnt 
  FROM vehicle_fitments 
  WHERE model IN ('A7L', 'Q2L e-tron', 'Mufasa', 'Aspire', 'NSX', 'Tuscani', 'JM', 'NF')
  GROUP BY make, model
`;
console.log('\nChecking for specific non-US models:');
if (testModels.length === 0) {
  console.log('  None found - database may already be clean or use different source');
} else {
  testModels.forEach(m => console.log(`  ${m.make} ${m.model}: ${m.cnt}`));
}

await sql.end();
