import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Make name mappings (gap tracker name -> DB name)
const MAKE_MAPPINGS = [
  { from: 'mercedes-benz', to: 'mercedes' },
  { from: 'alfa romeo', to: 'alfa-romeo' },
  { from: 'land rover', to: 'land-rover' },
  { from: 'aston martin', to: 'aston-martin' },
  { from: 'rolls royce', to: 'rolls-royce' },
];

const client = await pool.connect();

console.log('Clearing gaps with make name variants...\n');

let totalDeleted = 0;

for (const { from, to } of MAKE_MAPPINGS) {
  // Delete gaps where DB has the data under different make name
  const result = await client.query(`
    DELETE FROM unresolved_fitment_searches u
    WHERE u.make = $1
      AND EXISTS (
        SELECT 1 FROM vehicle_fitments v
        WHERE v.year = u.year
          AND LOWER(v.make) = $2
          AND LOWER(v.model) LIKE '%' || u.model || '%'
          AND v.oem_tire_sizes IS NOT NULL
          AND jsonb_array_length(v.oem_tire_sizes) > 0
      )
    RETURNING u.id
  `, [from, to]);
  
  console.log(`  "${from}" → "${to}": deleted ${result.rowCount} entries`);
  totalDeleted += result.rowCount;
}

// Also clear any with exact model matches (case insensitive)
const exactResult = await client.query(`
  DELETE FROM unresolved_fitment_searches u
  WHERE EXISTS (
    SELECT 1 FROM vehicle_fitments v
    WHERE v.year = u.year
      AND (
        LOWER(v.make) = u.make 
        OR LOWER(v.make) = REPLACE(u.make, ' ', '-')
        OR LOWER(v.make) = REPLACE(u.make, '-', ' ')
      )
      AND (
        LOWER(v.model) = u.model
        OR LOWER(v.model) = REPLACE(u.model, ' ', '-')
        OR LOWER(v.model) LIKE '%' || REPLACE(u.model, ' ', '-') || '%'
      )
      AND v.oem_tire_sizes IS NOT NULL
      AND jsonb_array_length(v.oem_tire_sizes) > 0
  )
  RETURNING u.id
`);

console.log(`  Exact/fuzzy model matches: deleted ${exactResult.rowCount} more entries`);
totalDeleted += exactResult.rowCount;

console.log(`\nTotal deleted: ${totalDeleted}`);

// Show remaining
const remaining = await client.query(`
  SELECT COUNT(*) as count, SUM(occurrence_count) as searches
  FROM unresolved_fitment_searches
`);

console.log(`Remaining: ${remaining.rows[0].count} vehicles, ${remaining.rows[0].searches} searches`);

await client.release();
await pool.end();
