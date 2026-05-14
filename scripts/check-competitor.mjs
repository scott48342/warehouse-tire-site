import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();
const r = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'competitor_page_analysis' ORDER BY ordinal_position`);
console.log(r.rows.map(c => `${c.column_name}: ${c.data_type}`).join('\n'));
await client.end();
