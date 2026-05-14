import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL);

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

for (const table of tables) {
  try {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = ${table}
      ORDER BY ordinal_position
    `;
    console.log(`\n=== ${table} (${cols.length} columns) ===`);
    cols.forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
  } catch (e) {
    console.log(`\n=== ${table} === ERROR: ${e.message}`);
  }
}

process.exit(0);
