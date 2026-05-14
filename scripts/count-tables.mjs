import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

const configCount = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitment_configurations`;
const fitmentCount = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE source != 'deprecated-staggered-split'`;
const deprecatedCount = await sql`SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE source = 'deprecated-staggered-split'`;

console.log('vehicle_fitment_configurations:', configCount[0].cnt);
console.log('vehicle_fitments (active):', fitmentCount[0].cnt);
console.log('vehicle_fitments (deprecated):', deprecatedCount[0].cnt);

await sql.end();
