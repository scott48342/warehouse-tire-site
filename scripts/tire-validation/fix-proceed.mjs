import dotenv from 'dotenv';
import postgres from 'postgres';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

const result = await sql`DELETE FROM vehicle_fitments WHERE year = 2007 AND LOWER(make) = 'kia' AND LOWER(model) = ${"pro-cee'd"}`;
console.log('Deleted: 2007 kia pro-ceed');
await sql.end();
