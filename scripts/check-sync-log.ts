import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const result = await sql.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'catalog_sync_log'
    ORDER BY ordinal_position
  `);
  console.log('=== catalog_sync_log ===');
  result.rows.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type}`));
}
main().then(() => process.exit(0));
