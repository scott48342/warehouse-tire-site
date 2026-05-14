import { sql } from '@vercel/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const tables = [
  'email_campaigns',
  'abandoned_carts', 
  'cart_add_events',
  'email_subscribers',
  'wheel_size_trim_mappings',
  'vehicle_fitment_configurations',
  'catalog_makes',
  'catalog_models',
  'analytics_sessions',
  'analytics_pageviews'
];

async function main() {
  for (const table of tables) {
    try {
      const result = await sql.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n=== ${table} (${result.rows.length} columns) ===`);
      result.rows.forEach((c: any) => {
        console.log(`  ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    } catch (e: any) {
      console.log(`\n=== ${table} === ERROR: ${e.message}`);
    }
  }
  process.exit(0);
}

main();
