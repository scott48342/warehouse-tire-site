import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const result = await sql.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'modification_aliases'
    ORDER BY ordinal_position
  `);
  console.log('=== modification_aliases ===');
  result.rows.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type}`));
}
main().then(() => process.exit(0));
