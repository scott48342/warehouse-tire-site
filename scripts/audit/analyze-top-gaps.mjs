import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();

// Get top individual gaps
const gaps = await client.query(`
  SELECT year, make, model, occurrence_count, search_type
  FROM unresolved_fitment_searches
  ORDER BY occurrence_count DESC
  LIMIT 30
`);

console.log('Top 30 gap vehicles - checking DB for matches:\n');
console.log('Gap Vehicle'.padEnd(50) + ' | Searches | DB Match');
console.log('-'.repeat(80));

for (const gap of gaps.rows) {
  // Try to find in DB
  const match = await client.query(`
    SELECT make, model, 
           CASE WHEN oem_tire_sizes IS NOT NULL AND jsonb_array_length(oem_tire_sizes) > 0 THEN 'HAS_TIRES' ELSE 'NO_TIRES' END as status
    FROM vehicle_fitments
    WHERE year = $1 
      AND (
        LOWER(make) = $2 
        OR LOWER(make) = REPLACE($2, ' ', '-')
        OR LOWER(make) = REPLACE($2, '-', '')
        OR LOWER(make) LIKE '%' || SPLIT_PART($2, '-', 1) || '%'
      )
      AND (
        LOWER(model) = $3
        OR LOWER(model) = REPLACE($3, ' ', '-')
        OR LOWER(model) LIKE '%' || $3 || '%'
        OR LOWER(model) LIKE '%' || REPLACE($3, ' ', '-') || '%'
        OR LOWER(model) LIKE '%' || SPLIT_PART($3, ' ', 1) || '%'
      )
    LIMIT 3
  `, [gap.year, gap.make, gap.model]);
  
  const gapStr = `${gap.year} ${gap.make} ${gap.model}`.substring(0, 48).padEnd(50);
  const searchStr = gap.occurrence_count.toString().padStart(3);
  
  if (match.rows.length > 0) {
    const dbMatch = match.rows.map(r => `${r.make}/${r.model}[${r.status}]`).join(', ');
    console.log(`${gapStr} | ${searchStr}      | ✅ ${dbMatch}`);
  } else {
    console.log(`${gapStr} | ${searchStr}      | ❌ NOT FOUND`);
  }
}

await client.release();
await pool.end();
